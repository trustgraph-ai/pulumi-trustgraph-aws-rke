
import * as aws from "@pulumi/aws";
import * as tls from "@pulumi/tls";

import { awsProvider } from './aws-provider';
import { prefix } from './config';

// ssh key, elliptic curve
export const sshKey = new tls.PrivateKey(
    "ssh-key",
    {
        algorithm: "ED25519",
    }
);

export const keypair = new aws.ec2.KeyPair(
    "keypair",
    {
        keyName: prefix + "-key",
        publicKey: sshKey.publicKeyOpenssh,
    },          
    { provider: awsProvider, }
);
