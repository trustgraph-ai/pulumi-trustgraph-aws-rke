
import * as k8s from '@pulumi/kubernetes';

import { k8sProvider } from './k8s-provider';
import { ebsCsiAccessKey } from './ebs-csi-user';

// Generate a credential secret for EBS CSI driver
const ebsCsiSecret = new k8s.core.v1.Secret(
    "ebs-csi-secret",
    {
        metadata: {
            name: "aws-secret",
            namespace: "kube-system"
        },
        stringData: {
            "key-id": ebsCsiAccessKey.id,
            "secret-key": ebsCsiAccessKey.secret,
        },
    },
    { provider: k8sProvider }
);

export const ebsCsiDeploy = new k8s.helm.v4.Chart(
    "ebs-csi-helm-deployment",
    {
        chart: "aws-ebs-csi-driver",
        name: "aws-ebs-csi-driver",
        namespace: "kube-system",
        repositoryOpts: {
            repo: "https://kubernetes-sigs.github.io/aws-ebs-csi-driver",
        },
        values: {
            awsAccessSecret: {
                name: ebsCsiSecret.metadata.name,
                keyId: "key-id",
                accessKey: "secret-key",
            }
        }
    },
    { provider: k8sProvider, dependsOn: ebsCsiSecret }
);

