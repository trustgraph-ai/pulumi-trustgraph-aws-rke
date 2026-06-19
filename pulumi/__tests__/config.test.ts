import * as pulumi from "@pulumi/pulumi";

pulumi.runtime.setMocks({
    newResource: function(args: pulumi.runtime.MockResourceArgs): {id: string, state: any} {
        return {
            id: args.inputs.name + "_id",
            state: args.inputs,
        };
    },
    call: function(args: pulumi.runtime.MockCallArgs) {
        if (args.token === "aws:index/getCallerIdentity:getCallerIdentity") {
            return { accountId: "123456789012", arn: "arn:aws:iam::123456789012:user/test" };
        }
        return args.inputs;
    },
});

describe("Configuration Loading", () => {
    beforeEach(() => {
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
    });

    afterEach(() => {
        jest.resetModules();
    });

    test("should load required configuration values", async () => {
        const config = await import("../config");

        expect(config.environment).toBe("test");
        expect(config.region).toBe("eu-west-2");
        expect(config.vpcCidr).toBe("172.38.0.0/16");
        expect(config.subnet1Cidr).toBe("172.38.48.0/20");
        expect(config.nodeType).toBe("t3a.xlarge");
        expect(config.agentNodeCount).toBe(3);
        expect(config.ami).toBe("ami-test123");
    });

    test("should generate correct prefix based on environment", async () => {
        const config = await import("../config");

        expect(config.prefix).toBe("trustgraph-test");
    });

    test("should compute correct private IPs from subnet CIDR", async () => {
        const config = await import("../config");

        expect(config.serverPrivateIp).toBe("172.38.48.10");
        expect(config.agentPrivateIps).toHaveLength(3);
        expect(config.agentPrivateIps[0]).toBe("172.38.48.20");
        expect(config.agentPrivateIps[1]).toBe("172.38.48.21");
        expect(config.agentPrivateIps[2]).toBe("172.38.48.22");
    });

    test("should load gateway configuration values", async () => {
        const config = await import("../config");

        expect(config.domain).toBe("app.example.com");
        expect(config.grafanaDomain).toBe("grafana.example.com");
        expect(config.letsencryptEmail).toBe("test@example.com");
    });

    test("should handle missing environment configuration", async () => {
        pulumi.runtime.setAllConfig({
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

        await expect(import("../config")).rejects.toThrow();
    });

    test("should handle missing domain configuration", async () => {
        pulumi.runtime.setAllConfig({
            "project:environment": "test",
            "project:region": "eu-west-2",
            "project:vpc-cidr": "172.38.0.0/16",
            "project:subnet-1-cidr": "172.38.48.0/20",
            "project:node-type": "t3a.xlarge",
            "project:agent-node-count": "3",
            "project:ami": "ami-test123",
            "project:grafana-domain": "grafana.example.com",
            "project:letsencrypt-email": "test@example.com",
        });

        await expect(import("../config")).rejects.toThrow();
    });

    test("should handle missing grafana-domain configuration", async () => {
        pulumi.runtime.setAllConfig({
            "project:environment": "test",
            "project:region": "eu-west-2",
            "project:vpc-cidr": "172.38.0.0/16",
            "project:subnet-1-cidr": "172.38.48.0/20",
            "project:node-type": "t3a.xlarge",
            "project:agent-node-count": "3",
            "project:ami": "ami-test123",
            "project:domain": "app.example.com",
            "project:letsencrypt-email": "test@example.com",
        });

        await expect(import("../config")).rejects.toThrow();
    });

    test("should handle missing letsencrypt-email configuration", async () => {
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
        });

        await expect(import("../config")).rejects.toThrow();
    });

    test("should generate correct tags separator string", async () => {
        const config = await import("../config");

        expect(config.tagsSep).toBe("");
    });
});
