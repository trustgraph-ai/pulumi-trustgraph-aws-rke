import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Global arrays to capture resources across all tests
const createdResources: Array<{type: string, name: string, inputs: any}> = [];
let resourceCount = 0;

describe("Infrastructure Creation", () => {
    beforeAll(() => {
        // Mock file system
        mockedFs.writeFile.mockImplementation(
            (_path: any, _data: any, cb: any) => cb?.(null)
        );
        mockedFs.readFileSync.mockImplementation((filePath: any, options: any) => {
            if (typeof filePath === 'string' && filePath.includes('resources.yaml')) {
                return `
apiVersion: v1
kind: Namespace
metadata:
  name: trustgraph
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
  namespace: trustgraph
spec:
  replicas: 1
`;
            }
            if (typeof filePath === 'string' && filePath.includes('server-init.sh')) {
                return '#!/bin/bash\necho server %INTERNAL-ADDR% %EXTERNAL-ADDR% %TOKEN%';
            }
            if (typeof filePath === 'string' && filePath.includes('agent-init.sh')) {
                return '#!/bin/bash\necho agent %SERVER-ADDR% %INTERNAL-ADDR% %TOKEN%';
            }
            return '';
        });

        // Set up configuration
        pulumi.runtime.setAllConfig({
            "project:environment": "test",
            "project:region": "eu-west-2",
            "project:vpc-cidr": "172.38.0.0/16",
            "project:subnet-1-cidr": "172.38.48.0/20",
            "project:node-type": "t3a.xlarge",
            "project:agent-node-count": "3",
            "project:ami": "ami-test123",
            "project:domain": "app.example.com",
            "project:grafana-domain": "grafana.example.com",
            "project:letsencrypt-email": "test@example.com",
        });

        // Set up mocks to capture resource creation
        pulumi.runtime.setMocks({
            newResource: function(args: pulumi.runtime.MockResourceArgs): {id: string, state: any} {
                resourceCount++;
                createdResources.push({
                    type: args.type,
                    name: args.name,
                    inputs: args.inputs
                });

                const mockId = `mock-${args.type}-${args.name}-${resourceCount}`;
                let state: any = {
                    ...args.inputs,
                    id: mockId,
                    name: args.inputs.name || args.name,
                };

                if (args.type === "tls:index/privateKey:PrivateKey") {
                    state.privateKeyOpenssh = "mock-ssh-private-key";
                    state.publicKeyOpenssh = "mock-ssh-public-key";
                }

                if (args.type === "aws:ec2/eip:Eip") {
                    state.publicIp = "1.2.3.4";
                }

                if (args.type === "aws:iam/accessKey:AccessKey") {
                    state.id = "AKIAIOSFODNN7EXAMPLE";
                    state.secret = "mock-secret-key";
                }

                if (args.type === "command:remote:Command") {
                    state.stdout = '{"apiVersion":"v1","clusters":[]}';
                }

                if (args.type === "aws:lb/loadBalancer:LoadBalancer") {
                    state.dnsName = "mock-nlb.elb.amazonaws.com";
                    state.arn = "arn:aws:elasticloadbalancing:eu-west-2:123456789012:loadbalancer/net/mock/1234";
                }

                if (args.type === "aws:lb/targetGroup:TargetGroup") {
                    state.arn = `arn:aws:elasticloadbalancing:eu-west-2:123456789012:targetgroup/${args.name}/1234`;
                }

                return { id: mockId, state };
            },
            call: function(args: pulumi.runtime.MockCallArgs) {
                if (args.token === "aws:index/getCallerIdentity:getCallerIdentity") {
                    return { accountId: "123456789012", arn: "arn:aws:iam::123456789012:user/test" };
                }
                return args.inputs;
            },
        });
    });

    test("infrastructure creates all expected resources correctly", async () => {
        // Import once to create all resources
        await expect(import("../index")).resolves.toBeDefined();

        // Wait a bit for async resource creation to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify that resources were created
        expect(createdResources.length).toBeGreaterThan(0);

        // Check for essential AWS resources
        const awsProvider = createdResources.find(r => r.type === "pulumi:providers:aws");
        const vpc = createdResources.find(r => r.type === "aws:ec2/vpc:Vpc");
        const subnet = createdResources.find(r => r.type === "aws:ec2/subnet:Subnet");
        const serverInstance = createdResources.find(
            r => r.type === "aws:ec2/instance:Instance" && r.name === "ec2-server-instance"
        );
        const agentInstances = createdResources.filter(
            r => r.type === "aws:ec2/instance:Instance" && r.name.startsWith("ec2-agent-instance")
        );

        expect(awsProvider).toBeDefined();
        expect(vpc).toBeDefined();
        expect(subnet).toBeDefined();
        expect(serverInstance).toBeDefined();
        expect(agentInstances).toHaveLength(3);

        // Check security groups
        const serverSg = createdResources.find(
            r => r.type === "aws:ec2/securityGroup:SecurityGroup" && r.name === "server-security-group"
        );
        const agentSg = createdResources.find(
            r => r.type === "aws:ec2/securityGroup:SecurityGroup" && r.name === "agent-security-group"
        );
        expect(serverSg).toBeDefined();
        expect(agentSg).toBeDefined();

        // Verify agent security group has HTTP/HTTPS ingress
        const agentIngress = agentSg?.inputs.ingress;
        const httpRule = agentIngress?.find((r: any) => r.fromPort === 80 && r.toPort === 80);
        const httpsRule = agentIngress?.find((r: any) => r.fromPort === 443 && r.toPort === 443);
        expect(httpRule).toBeDefined();
        expect(httpsRule).toBeDefined();

        // Check for Kubernetes secrets
        const secrets = createdResources.filter(r => r.type === "kubernetes:core/v1:Secret");
        const iamSecret = secrets.find(s => s.inputs.metadata?.name === "iam-bootstrap-token");
        const grafanaSecret = secrets.find(s => s.inputs.metadata?.name === "grafana-secret");
        const aiSecret = secrets.find(s => s.inputs.metadata?.name === "bedrock-credentials");

        expect(iamSecret).toBeDefined();
        expect(grafanaSecret).toBeDefined();
        expect(aiSecret).toBeDefined();

        // Check for NLB resources
        const nlb = createdResources.find(r => r.type === "aws:lb/loadBalancer:LoadBalancer");
        const httpTg = createdResources.find(
            r => r.type === "aws:lb/targetGroup:TargetGroup" && r.name === "http-target-group"
        );
        const httpsTg = createdResources.find(
            r => r.type === "aws:lb/targetGroup:TargetGroup" && r.name === "https-target-group"
        );
        const listeners = createdResources.filter(r => r.type === "aws:lb/listener:Listener");
        const targetAttachments = createdResources.filter(
            r => r.type === "aws:lb/targetGroupAttachment:TargetGroupAttachment"
        );

        expect(nlb).toBeDefined();
        expect(nlb?.inputs.loadBalancerType).toBe("network");
        expect(httpTg).toBeDefined();
        expect(httpsTg).toBeDefined();
        expect(listeners).toHaveLength(2);
        // 3 agents × 2 target groups = 6 attachments
        expect(targetAttachments).toHaveLength(6);

        // Check for cert-manager resources
        const certManagerNs = createdResources.find(
            r => r.type === "kubernetes:core/v1:Namespace" && r.inputs.metadata?.name === "cert-manager"
        );
        expect(certManagerNs).toBeDefined();

        const certManagerChart = createdResources.find(
            r => r.name === "cert-manager" && r.type === "kubernetes:helm.sh/v4:Chart"
        );
        expect(certManagerChart).toBeDefined();

        const clusterIssuer = createdResources.find(
            r => r.type === "kubernetes:cert-manager.io/v1:ClusterIssuer"
        );
        expect(clusterIssuer).toBeDefined();

        // Check for Nginx Gateway Fabric resources
        const ngfNs = createdResources.find(
            r => r.type === "kubernetes:core/v1:Namespace" && r.inputs.metadata?.name === "nginx-gateway"
        );
        expect(ngfNs).toBeDefined();

        const ngfChart = createdResources.find(
            r => r.name === "nginx-gateway-fabric" && r.type === "kubernetes:helm.sh/v4:Chart"
        );
        expect(ngfChart).toBeDefined();

        // Check for Gateway
        const gw = createdResources.find(
            r => r.type === "kubernetes:gateway.networking.k8s.io/v1:Gateway"
        );
        expect(gw).toBeDefined();
        expect(gw?.inputs.spec?.gatewayClassName).toBe("nginx");
        expect(gw?.inputs.spec?.listeners).toHaveLength(3);

        // Check for Certificates
        const uiCert = createdResources.find(
            r => r.type === "kubernetes:cert-manager.io/v1:Certificate" && r.name === "ui-cert"
        );
        const grafanaCert = createdResources.find(
            r => r.type === "kubernetes:cert-manager.io/v1:Certificate" && r.name === "grafana-cert"
        );
        expect(uiCert).toBeDefined();
        expect(grafanaCert).toBeDefined();

        // Check for HTTPRoutes
        const uiRoute = createdResources.find(
            r => r.type === "kubernetes:gateway.networking.k8s.io/v1:HTTPRoute" && r.name === "ui-route"
        );
        const grafanaRoute = createdResources.find(
            r => r.type === "kubernetes:gateway.networking.k8s.io/v1:HTTPRoute" && r.name === "grafana-route"
        );
        expect(uiRoute).toBeDefined();
        expect(grafanaRoute).toBeDefined();
    });
});
