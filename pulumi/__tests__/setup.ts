import * as fs from 'fs';

// Mock fs module for resources.yaml, init scripts, and file writing
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

mockedFs.readFileSync.mockImplementation((filePath: any, options: any) => {
    if (typeof filePath === 'string' && filePath.includes('resources.yaml')) {
        return `
apiVersion: v1
kind: Namespace
metadata:
  name: trustgraph
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
  namespace: trustgraph
data:
  test: "value"
`;
    }
    if (typeof filePath === 'string' && filePath.includes('server-init.sh')) {
        return '#!/bin/bash\necho server %INTERNAL-ADDR% %EXTERNAL-ADDR% %TOKEN%';
    }
    if (typeof filePath === 'string' && filePath.includes('agent-init.sh')) {
        return '#!/bin/bash\necho agent %SERVER-ADDR% %INTERNAL-ADDR% %TOKEN%';
    }
    return jest.requireActual('fs').readFileSync(filePath, options);
});

mockedFs.writeFile.mockImplementation(
    (_path: any, _data: any, cb: any) => cb?.(null)
);
