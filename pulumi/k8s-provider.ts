
import * as k8s from "@pulumi/kubernetes";

import { serverInstance } from './server-instances';
import { agentInstances } from './agent-instances';
import { kubeconfig } from './kubeconfig';

// Create a Kubernetes provider using the cluster's kubeconfig
export const k8sProvider = new k8s.Provider(
    "k8sProvider",
    {
        kubeconfig: kubeconfig,
    },
    {
        dependsOn: [serverInstance, ...agentInstances],
    }
);

