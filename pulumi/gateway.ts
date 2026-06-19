
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";

import { awsProvider } from './aws-provider';
import { k8sProvider } from './k8s-provider';
import { prefix, domain, grafanaDomain, letsencryptEmail } from './config';
import { vpc, subnet1 } from './vpc';
import { agentInstances } from './agent-instances';
import { appDeploy } from './app';

// ---------- AWS NLB ----------

const nlb = new aws.lb.LoadBalancer(
    "gateway-nlb",
    {
        name: prefix + "-gateway",
        internal: false,
        loadBalancerType: "network",
        subnets: [subnet1.id],
        tags: {
            Name: prefix + "-gateway",
        },
    },
    { provider: awsProvider }
);

const httpTargetGroup = new aws.lb.TargetGroup(
    "http-target-group",
    {
        name: prefix + "-http",
        port: 80,
        protocol: "TCP",
        vpcId: vpc.id,
        targetType: "instance",
        healthCheck: {
            protocol: "TCP",
            port: "80",
        },
        tags: {
            Name: prefix + "-http",
        },
    },
    { provider: awsProvider }
);

const httpsTargetGroup = new aws.lb.TargetGroup(
    "https-target-group",
    {
        name: prefix + "-https",
        port: 443,
        protocol: "TCP",
        vpcId: vpc.id,
        targetType: "instance",
        healthCheck: {
            protocol: "TCP",
            port: "443",
        },
        tags: {
            Name: prefix + "-https",
        },
    },
    { provider: awsProvider }
);

// Register agent instances with target groups
agentInstances.forEach((instance, ix) => {
    new aws.lb.TargetGroupAttachment(
        `http-target-${ix}`,
        {
            targetGroupArn: httpTargetGroup.arn,
            targetId: instance.id,
            port: 80,
        },
        { provider: awsProvider }
    );
    new aws.lb.TargetGroupAttachment(
        `https-target-${ix}`,
        {
            targetGroupArn: httpsTargetGroup.arn,
            targetId: instance.id,
            port: 443,
        },
        { provider: awsProvider }
    );
});

new aws.lb.Listener(
    "http-listener",
    {
        loadBalancerArn: nlb.arn,
        port: 80,
        protocol: "TCP",
        defaultActions: [{
            type: "forward",
            targetGroupArn: httpTargetGroup.arn,
        }],
    },
    { provider: awsProvider }
);

new aws.lb.Listener(
    "https-listener",
    {
        loadBalancerArn: nlb.arn,
        port: 443,
        protocol: "TCP",
        defaultActions: [{
            type: "forward",
            targetGroupArn: httpsTargetGroup.arn,
        }],
    },
    { provider: awsProvider }
);

// ---------- cert-manager ----------

const certManagerNamespace = new k8s.core.v1.Namespace(
    "cert-manager",
    {
        metadata: { name: "cert-manager" },
    },
    { provider: k8sProvider }
);

const certManager = new k8s.helm.v4.Chart(
    "cert-manager",
    {
        chart: "oci://quay.io/jetstack/charts/cert-manager",
        version: "v1.17.2",
        namespace: "cert-manager",
        values: {
            crds: { enabled: true },
            config: { enableGatewayAPI: true },
        },
    },
    { provider: k8sProvider, dependsOn: [certManagerNamespace] }
);

const letsEncryptIssuer = new k8s.apiextensions.CustomResource(
    "letsencrypt-issuer",
    {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: "letsencrypt-prod" },
        spec: {
            acme: {
                server: "https://acme-v02.api.letsencrypt.org/directory",
                email: letsencryptEmail,
                privateKeySecretRef: {
                    name: "letsencrypt-private-key",
                },
                solvers: [{
                    http01: {
                        gatewayHTTPRoute: {
                            parentRefs: [{
                                name: "trustgraph-gateway",
                                namespace: "trustgraph",
                                kind: "Gateway",
                            }],
                        },
                    },
                }],
            },
        },
    },
    { provider: k8sProvider, dependsOn: [certManager] }
);

// ---------- Nginx Gateway Fabric ----------

const ngfNamespace = new k8s.core.v1.Namespace(
    "nginx-gateway",
    {
        metadata: { name: "nginx-gateway" },
    },
    { provider: k8sProvider }
);

const nginxGatewayFabric = new k8s.helm.v4.Chart(
    "nginx-gateway-fabric",
    {
        chart: "oci://ghcr.io/nginx/charts/nginx-gateway-fabric",
        version: "1.6.2",
        namespace: "nginx-gateway",
        values: {
            nginxGateway: {
                gatewayClassName: "nginx",
            },
            service: {
                type: "NodePort",
                ports: [
                    {
                        port: 80,
                        targetPort: 80,
                        protocol: "TCP",
                        name: "http",
                        nodePort: 80,
                    },
                    {
                        port: 443,
                        targetPort: 443,
                        protocol: "TCP",
                        name: "https",
                        nodePort: 443,
                    },
                ],
            },
            nginxProxy: {
                hostPorts: {
                    enable: true,
                    ports: {
                        http: 80,
                        https: 443,
                    },
                },
            },
        },
    },
    { provider: k8sProvider, dependsOn: [ngfNamespace] }
);

// ---------- Gateway + TLS + Routes ----------

const gateway = new k8s.apiextensions.CustomResource(
    "trustgraph-gateway",
    {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "Gateway",
        metadata: {
            name: "trustgraph-gateway",
            namespace: "trustgraph",
        },
        spec: {
            gatewayClassName: "nginx",
            listeners: [
                {
                    name: "http",
                    protocol: "HTTP",
                    port: 80,
                    allowedRoutes: {
                        namespaces: { from: "Same" },
                    },
                },
                {
                    name: "https-ui",
                    protocol: "HTTPS",
                    port: 443,
                    hostname: domain,
                    tls: {
                        certificateRefs: [{
                            name: "ui-tls",
                        }],
                    },
                    allowedRoutes: {
                        namespaces: { from: "Same" },
                    },
                },
                {
                    name: "https-grafana",
                    protocol: "HTTPS",
                    port: 443,
                    hostname: grafanaDomain,
                    tls: {
                        certificateRefs: [{
                            name: "grafana-tls",
                        }],
                    },
                    allowedRoutes: {
                        namespaces: { from: "Same" },
                    },
                },
            ],
        },
    },
    { provider: k8sProvider, dependsOn: [nginxGatewayFabric, appDeploy] }
);

const uiCertificate = new k8s.apiextensions.CustomResource(
    "ui-cert",
    {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
            name: "ui-cert",
            namespace: "trustgraph",
        },
        spec: {
            secretName: "ui-tls",
            issuerRef: {
                name: "letsencrypt-prod",
                kind: "ClusterIssuer",
            },
            dnsNames: [domain],
        },
    },
    { provider: k8sProvider, dependsOn: [letsEncryptIssuer, gateway] }
);

const grafanaCertificate = new k8s.apiextensions.CustomResource(
    "grafana-cert",
    {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
            name: "grafana-cert",
            namespace: "trustgraph",
        },
        spec: {
            secretName: "grafana-tls",
            issuerRef: {
                name: "letsencrypt-prod",
                kind: "ClusterIssuer",
            },
            dnsNames: [grafanaDomain],
        },
    },
    { provider: k8sProvider, dependsOn: [letsEncryptIssuer, gateway] }
);

const uiRoute = new k8s.apiextensions.CustomResource(
    "ui-route",
    {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "HTTPRoute",
        metadata: {
            name: "ui-route",
            namespace: "trustgraph",
        },
        spec: {
            parentRefs: [
                {
                    name: "trustgraph-gateway",
                    sectionName: "https-ui",
                },
                {
                    name: "trustgraph-gateway",
                    sectionName: "http",
                },
            ],
            hostnames: [domain],
            rules: [{
                backendRefs: [{
                    name: "trustgraph-ui",
                    port: 8888,
                }],
            }],
        },
    },
    { provider: k8sProvider, dependsOn: [gateway] }
);

const grafanaRoute = new k8s.apiextensions.CustomResource(
    "grafana-route",
    {
        apiVersion: "gateway.networking.k8s.io/v1",
        kind: "HTTPRoute",
        metadata: {
            name: "grafana-route",
            namespace: "trustgraph",
        },
        spec: {
            parentRefs: [
                {
                    name: "trustgraph-gateway",
                    sectionName: "https-grafana",
                },
                {
                    name: "trustgraph-gateway",
                    sectionName: "http",
                },
            ],
            hostnames: [grafanaDomain],
            rules: [{
                backendRefs: [{
                    name: "grafana",
                    port: 3000,
                }],
            }],
        },
    },
    { provider: k8sProvider, dependsOn: [gateway] }
);

export const nlbDnsName = nlb.dnsName;
