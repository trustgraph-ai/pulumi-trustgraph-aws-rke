
import * as fs from 'fs';
import * as pulumi from '@pulumi/pulumi';

import { serverAddress } from './addresses';
import { sshKey } from './keypair';
import { kubeconfig } from './kubeconfig';
import { appDeploy, iamBootstrapToken, grafanaAdminPassword } from './app';
import { nlbDnsName } from './gateway';

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

export const server = serverAddress.publicIp;

export const iamToken = pulumi.interpolate`tg_${iamBootstrapToken.result}`;

export const grafanaPassword = grafanaAdminPassword.result;

// --------------------------------------------------------------------------

export { nlbDnsName };

