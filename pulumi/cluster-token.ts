
import * as random from "@pulumi/random";

export const clusterToken = new random.RandomPassword(
    "cluster-token",
    {
        length: 48,
        special: false,
    }
);

