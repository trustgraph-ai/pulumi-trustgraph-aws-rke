
import * as fs from 'fs';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

import { region } from './config';
import { aiAccessKey } from './bedrock-user';
import { ebsCsiDeploy } from './ebs-csi-deployment';
import { k8sProvider } from './k8s-provider';

export const iamBootstrapToken = new random.RandomPassword(
    "iam-bootstrap-token",
    {
        length: 32,
        special: false,
    },
);

export const grafanaAdminPassword = new random.RandomPassword(
    "grafana-admin-password",
    {
        length: 16,
        special: true,
        overrideSpecial: "!@#$%^&*",
    },
);

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

const iamSecret = new k8s.core.v1.Secret(
    "iam-bootstrap-token",
    {
        metadata: {
            name: "iam-bootstrap-token",
            namespace: "trustgraph"
        },
        stringData: {
            "token": pulumi.interpolate`tg_${iamBootstrapToken.result}`,
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

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


const grafanaSecret = new k8s.core.v1.Secret(
    "grafana-secret",
    {
        metadata: {
            name: "grafana-secret",
            namespace: "trustgraph"
        },
        stringData: {
            "password": grafanaAdminPassword.result,
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

