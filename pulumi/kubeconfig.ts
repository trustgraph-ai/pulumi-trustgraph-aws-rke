
import * as pulumi from "@pulumi/pulumi";
import * as command from '@pulumi/command';

import { addresses } from './addresses';
import { serverInstance } from './server-instances';
import { agentInstances } from './agent-instances';
import { sshKey } from './keypair';

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
        dependsOn: [serverInstance, ...agentInstances],
    }
);

export const kubeconfig = pulumi.all([
    fetchKubeconfig.stdout, addresses[0].publicIp
]).apply(
    ([cfg, ip]) => cfg.replace("127.0.0.1", ip)
);

