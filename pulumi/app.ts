
import * as fs from 'fs';
import * as k8s from '@pulumi/kubernetes';

import { region } from './config';
import { aiAccessKey } from './bedrock-user';
import { ebsCsiDeploy } from './ebs-csi-deployment';
import { k8sProvider } from './k8s-provider';

// Get application resource definitions
const resourceDefs = fs.readFileSync("../resources.yaml", {encoding: "utf-8"});

// Deploy resources to the K8s cluster
export const appDeploy = new k8s.yaml.v2.ConfigGroup(
    "resources",
    {
        yaml: resourceDefs,
        skipAwait: true,
    },
    { provider: k8sProvider, dependsOn: ebsCsiDeploy }
);

// Generate an (empty) gateway secret - no authentication
const gatewaySecret = new k8s.core.v1.Secret(
    "gateway-secret",
    {
        metadata: {
            name: "gateway-secret",
            namespace: "trustgraph"
        },
        stringData: {
            "gateway-secret": ""
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

// Generate an (empty) gateway secret - no authentication
const aiSecret = new k8s.core.v1.Secret(
    "ai-secret",
    {
        metadata: {
            name: "bedrock-credentials",
            namespace: "trustgraph"
        },
        stringData: {
            "aws-id-key": aiAccessKey.id,
            "aws-secret": aiAccessKey.secret,
            "aws-region": region,
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

