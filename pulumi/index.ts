
import * as pulumi from "@pulumi/pulumi";
import * as tls from "@pulumi/tls";
import * as random from "@pulumi/random";
import * as aws from "@pulumi/aws";
import * as k8s from '@pulumi/kubernetes';
import * as command from '@pulumi/command';
import * as fs from 'fs';

import { prefix, vpcCidr, region, subnet1Cidr } from './config';
import { nodeType, nodeCount, volumeSize } from './config';
import { awsProvider, accountId } from './aws-provider';

// Docs here:
// https://docs.aws.amazon.com/eks/latest/userguide/create-cluster.html

// ----------------------------------------------------------------------------

// Step 0: Create a VPC and subnets.  Public IPs allocated on the subnets.

// Create a VPC
const vpc = new aws.ec2.Vpc(
    "vpc",
    {
        cidrBlock: vpcCidr,
        enableDnsHostnames: true,
        enableDnsSupport: true,
        tags: {
            Name: prefix,
        },
    },
    { provider: awsProvider }
);

// Create Subnets
const subnet1 = new aws.ec2.Subnet(
    "subnet-1", {
        vpcId: vpc.id,
        cidrBlock: subnet1Cidr,
        mapPublicIpOnLaunch: true,
        availabilityZone: region + "a",
        tags: {
            Name: prefix + "-subnet1",
        },
    },
    { provider: awsProvider }
);

const gateway = new aws.ec2.InternetGateway(
    "internet-gateway",
    {
        vpcId: vpc.id,
        tags: {
            "Name": prefix,
        },
    },
    { provider: awsProvider }
);

const routetable = new aws.ec2.RouteTable(
    "routetable",
    {
        routes: [
            {
                cidrBlock: "0.0.0.0/0",
                gatewayId: gateway.id,
            }
        ],
        vpcId: vpc.id,
        tags: {
            "Name": prefix,
        }
    },
    { provider: awsProvider }
);

const association = new aws.ec2.MainRouteTableAssociation(
    "routetable-association",
    {
        routeTableId: routetable.id,
        vpcId: vpc.id,
    },
    { provider: awsProvider }
);

// ----------------------------------------------------------------------------

// Create a node IAM role

// Create an RKE cluster node role
const nodeRole = new aws.iam.Role(
    "node-role",
    {
        name: "rkeNodeRole-" + prefix,
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        Service: "ec2.amazonaws.com",
                    },
                    Action: "sts:AssumeRole",
                }
            ],
        }),
    },
    { provider: awsProvider }
);

new aws.iam.RolePolicyAttachment(
    "cluster-role-policy-attachment-1",
    {
        role: nodeRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    },
    { provider: awsProvider }
);

// ----------------------------------------------------------------------------

// Create an IAM role for the EBS CSI driver

// Create an RKE cluster node role
const ebsCsiUser = new aws.iam.User(
    "ebs-csi-user",
    {
        name: "rke-ebs-csi-" + prefix,
    },
    { provider: awsProvider }
);

const rkeEbsCsiPolicyDef = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeInstances",
        "ec2:DescribeSnapshots",
        "ec2:DescribeTags",
        "ec2:DescribeVolumes",
        "ec2:DescribeVolumesModifications"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateSnapshot",
        "ec2:ModifyVolume"
      ],
      "Resource": "arn:aws:ec2:*:*:volume/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:AttachVolume",
        "ec2:DetachVolume"
      ],
      "Resource": [
        "arn:aws:ec2:*:*:volume/*",
        "arn:aws:ec2:*:*:instance/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateVolume",
        "ec2:EnableFastSnapshotRestores"
      ],
      "Resource": "arn:aws:ec2:*:*:snapshot/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateTags"
      ],
      "Resource": [
        "arn:aws:ec2:*:*:volume/*",
        "arn:aws:ec2:*:*:snapshot/*"
      ],
      "Condition": {
        "StringEquals": {
          "ec2:CreateAction": [
            "CreateVolume",
            "CreateSnapshot"
          ]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DeleteTags"
      ],
      "Resource": [
        "arn:aws:ec2:*:*:volume/*",
        "arn:aws:ec2:*:*:snapshot/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateVolume"
      ],
      "Resource": "arn:aws:ec2:*:*:volume/*",
      "Condition": {
        "StringLike": {
          "aws:RequestTag/ebs.csi.aws.com/cluster": "true"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateVolume"
      ],
      "Resource": "arn:aws:ec2:*:*:volume/*",
      "Condition": {
        "StringLike": {
          "aws:RequestTag/CSIVolumeName": "*"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DeleteVolume"
      ],
      "Resource": "arn:aws:ec2:*:*:volume/*",
      "Condition": {
        "StringLike": {
          "ec2:ResourceTag/ebs.csi.aws.com/cluster": "true"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DeleteVolume"
      ],
      "Resource": "arn:aws:ec2:*:*:volume/*",
      "Condition": {
        "StringLike": {
          "ec2:ResourceTag/CSIVolumeName": "*"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DeleteVolume"
      ],
      "Resource": "arn:aws:ec2:*:*:volume/*",
      "Condition": {
        "StringLike": {
          "ec2:ResourceTag/kubernetes.io/created-for/pvc/name": "*"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateSnapshot"
      ],
      "Resource": "arn:aws:ec2:*:*:snapshot/*",
      "Condition": {
        "StringLike": {
          "aws:RequestTag/CSIVolumeSnapshotName": "*"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateSnapshot"
      ],
      "Resource": "arn:aws:ec2:*:*:snapshot/*",
      "Condition": {
        "StringLike": {
          "aws:RequestTag/ebs.csi.aws.com/cluster": "true"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DeleteSnapshot"
      ],
      "Resource": "arn:aws:ec2:*:*:snapshot/*",
      "Condition": {
        "StringLike": {
          "ec2:ResourceTag/CSIVolumeSnapshotName": "*"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DeleteSnapshot"
      ],
      "Resource": "arn:aws:ec2:*:*:snapshot/*",
      "Condition": {
        "StringLike": {
          "ec2:ResourceTag/ebs.csi.aws.com/cluster": "true"
        }
      }
    }
  ]
};

const rkeEbsCsiPolicy = new aws.iam.Policy(
    "ebs-csi-policy",
    {
        name: "RkeCSIDriverPolicy-" + prefix,
        path: "/",
        description: "Policy for RKE EBS CSI driver to setup EBS volumes",
        policy: JSON.stringify(rkeEbsCsiPolicyDef),
    },
    { provider: awsProvider }
);

new aws.iam.UserPolicyAttachment(
    "ebs-csi-user-policy-attachment-1",
    {
        user: ebsCsiUser.name,
        policyArn: rkeEbsCsiPolicy.arn,
    },
    { provider: awsProvider }
);

const ebsCsiAccessKey = new aws.iam.AccessKey(
    "ebs-csi-access-key",
    {
        user: ebsCsiUser.name,
    },
    { provider: awsProvider }
);

// ----------------------------------------------------------------------------

const aiUser = new aws.iam.User(
    "ai-user",
    {
        name: prefix + "-ai-user",
        path: "/",
    },
    { provider: awsProvider, }
);

// Add bedrock
new aws.iam.UserPolicyAttachment(
    "ai-role-policy-attachment-1",
    {
        user: aiUser.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonBedrockFullAccess",
    },
    { provider: awsProvider, }
);

const aiAccessKey = new aws.iam.AccessKey(
    "ai-access-key",
    {
        user: aiUser.name,
    },
    { provider: awsProvider, }
);

// ----------------------------------------------------------------------------

// Security group
const secGroup = new aws.ec2.SecurityGroup(
    "security-group",
    {
        vpcId: vpc.id,
        description: "Enables access to EC2",
        ingress: [
            // SSH
            {
                protocol: 'tcp',
                fromPort: 22,
                toPort: 22,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // Kubernetes API
            {
                protocol: 'tcp',
                fromPort: 6443,
                toPort: 6443,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // RKE2 supervisor API
            {
                protocol: 'tcp',
                fromPort: 9345,
                toPort: 9345,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // kubelet metrics
            {
                protocol: 'tcp',
                fromPort: 10250,
                toPort: 10250,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // etcd client
            {
                protocol: 'tcp',
                fromPort: 2379,
                toPort: 2379,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // etcd peer port
            {
                protocol: 'tcp',
                fromPort: 2380,
                toPort: 2380,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // etcd metrics port
            {
                protocol: 'tcp',
                fromPort: 2381,
                toPort: 2381,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            {
                protocol: 'tcp',
                fromPort: 30000,
                toPort: 32767,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            // Canal
            {
                protocol: 'udp',
                fromPort: 8472,
                toPort: 8472,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
            {
                protocol: 'tcp',
                fromPort: 9099,
                toPort: 9099,
                cidrBlocks: [ "0.0.0.0/0" ],
            },
        ],
        egress: [
            {
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: ['0.0.0.0/0'],
                ipv6CidrBlocks: ["::/0"],
            }
        ],
        tags: {
            "Name": prefix,
        }
    },
    { provider: awsProvider }
);

// ----------------------------------------------------------------------------

const addresses = Array.from(Array(nodeCount).keys()).map(
    ix => new aws.ec2.Eip(
        `address-${ix}`,
        {
            tags: {
                Name: `${prefix}-node-${ix}`,
            }
        },
        { provider: awsProvider }
    )
);

const interfaces = Array.from(Array(nodeCount).keys()).map(
    ix => new aws.ec2.NetworkInterface(
        `network-interface-${ix}`,
        {
            subnetId: subnet1.id,
            securityGroups: [ secGroup.id ],
        },
        { provider: awsProvider }
    )
);

Array.from(Array(nodeCount).keys()).map(
    ix => new aws.ec2.EipAssociation(
        `assocation-${ix}`,
        {
            allocationId: addresses[ix].id,
            networkInterfaceId: interfaces[ix].id,
        },
        { provider: awsProvider }
    )
);

// ----------------------------------------------------------------------------

// ssh key, elliptic curve
const sshKey = new tls.PrivateKey(
    "ssh-key",
    {
        algorithm: "ED25519",
    }
);

const keypair = new aws.ec2.KeyPair(
    "keypair",
    {
        keyName: prefix + "-key",
        publicKey: sshKey.publicKeyOpenssh,
    },          
    { provider: awsProvider, }
);

// ----------------------------------------------------------------------------

const instanceProfile = new aws.iam.InstanceProfile(
    "ec2-instance-profile",
    {
        role: nodeRole.name,
    },
    { provider: awsProvider, }
);

// ----------------------------------------------------------------------------

const clusterToken = new random.RandomPassword(
    "cluster-token",
    {
        length: 48,
        special: false,
    }
);
// ----------------------------------------------------------------------------

// Amazon Linux 2023, x86-64 in us-west-2 (Oregon).
const ami = "ami-0f9d441b5d66d5f31";

const serverTemplate = fs.readFileSync("../server-init.sh").toString();
const agentTemplate = fs.readFileSync("../agent-init.sh").toString();

const serverUserData = pulumi.all(
    [addresses[0].publicIp, clusterToken.result]
).apply(
    ([address, token]) => {
        if (address == undefined) {
            console.log("AWS EIP has no IP address!");
            return "";
        }
        return btoa(
            serverTemplate.
                replace("%MY-IP%", address).
                replace("%TOKEN%", token)
        );
    }
);

const serverInstance = new aws.ec2.Instance(
    "ec2-instance-0",
    {
        ami: ami,
        availabilityZone: region + "a",
        instanceType: nodeType,
        keyName: keypair.keyName,
        networkInterfaces: [
            {
                deviceIndex: 0,
                networkInterfaceId: interfaces[0].id,
                deleteOnTermination: false,
            }
        ],
        iamInstanceProfile: instanceProfile.name,
        rootBlockDevice: {
            volumeSize: volumeSize,
            volumeType: "gp3",
            deleteOnTermination: true,
            encrypted: true,
            tags: {
                Name: prefix,
            },
        },
        metadataOptions: {
            httpEndpoint: 'enabled',
            httpPutResponseHopLimit: 2,
        },
        tags: {
            Name: `${prefix}-node-0`,
        },
        userData: serverUserData,
        userDataReplaceOnChange: true,
    },
    { provider: awsProvider, }
);

// ----------------------------------------------------------------------------

const instances = Array.from(Array(nodeCount - 1).keys()).map(
    ix => {

        const userData = pulumi.all([
            addresses[0].publicIp, addresses[ix+1].publicIp, clusterToken.result
        ]).apply(
            ([server, me, token]) => {
                if (server === undefined) {
                    console.log("AWS EIP has no IP address!");
                    return "";
                }
                if (me === undefined) {
                    console.log("AWS EIP has no IP address!");
                    return "";
                }
                return btoa(
                    agentTemplate.
                        replace("%SERVER-IP%", server).
                        replace("%MY-IP%", me).
                        replace("%TOKEN%", token)
                )
            }
        );

        return new aws.ec2.Instance(
            `ec2-instance-${ix + 1}`,
            {
                ami: ami,
                availabilityZone: region + "a",
                instanceType: nodeType,
                keyName: keypair.keyName,
                networkInterfaces: [
                    {
                        deviceIndex: 0,
                        networkInterfaceId: interfaces[ix + 1].id,
                        deleteOnTermination: false,
                    }
                ],
                iamInstanceProfile: instanceProfile.name,
                rootBlockDevice: {
                    volumeSize: volumeSize,
                    volumeType: "gp3",
                    deleteOnTermination: true,
                    encrypted: true,
                    tags: {
                        Name: prefix,
                    },
                },
                metadataOptions: {
                    httpEndpoint: 'enabled',
                    httpPutResponseHopLimit: 2,
                },
                tags: {
                    Name: `${prefix}-node-${ix+1}`,
                },
                userData: userData,
                userDataReplaceOnChange: true,
            },
            {
                provider: awsProvider,
                dependsOn: [serverInstance]
            }
        )
    }
);

// --------------------------------------------------------------------------

const fetchKubeconfig = new command.remote.Command(
    "get-kubeconfig",
    {
        create: "/usr/local/bin/wait-for-kubeconfig",
        connection: {
            host: addresses[0].publicIp,
            user: "ec2-user",
            privateKey: sshKey.privateKeyOpenssh,
        },
    },
    {
        dependsOn: [serverInstance, ...instances],
    }
);

const kubeconfig = pulumi.all([
    fetchKubeconfig.stdout, addresses[0].publicIp
]).apply(
    ([cfg, ip]) => cfg.replace("127.0.0.1", ip)
);

// --------------------------------------------------------------------------

sshKey.privateKeyOpenssh.apply(
    (key) => {
        fs.writeFile(
            "ssh-private.key",
            key,
            err => {
                if (err) {
                    console.log(err);
                    throw(err);
                } else {
                    console.log("Wrote private key.");
                }
            }
        );
    }
);

export const address0 = addresses[0].publicIp;

// Write the kubeconfig to a file
kubeconfig.apply(
    (key : string) => {
        fs.writeFile(
            "kube.cfg",
            key,
            err => {
                if (err) {
                    console.log(err);
                    throw(err);
                } else {
                    console.log("Wrote kube.cfg.");
                }
            }
        );
    }
);

// --------------------------------------------------------------------------

// Create a Kubernetes provider using the cluster's kubeconfig
const k8sProvider = new k8s.Provider(
    "k8sProvider",
    {
        kubeconfig: kubeconfig,
    },
    {
        dependsOn: [serverInstance, ...instances],
    }
);

// --------------------------------------------------------------------------

// Generate an (empty) gateway secret - no authentication
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

const ebsCsiDeploy = new k8s.helm.v4.Chart(
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

// --------------------------------------------------------------------------

// --------------------------------------------------------------------------

// Get application resource definitions
const resourceDefs = fs.readFileSync("../resources.yaml", {encoding: "utf-8"});

// Deploy resources to the K8s cluster
const appDeploy = new k8s.yaml.v2.ConfigGroup(
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

