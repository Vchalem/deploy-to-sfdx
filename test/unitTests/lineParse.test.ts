import * as util from 'util';

import * as fs from 'fs-extra';

import { testRepos } from '../testRepos';
import { lineParse } from '../../src/lib/lineParse';
import * as utilities from '../../src/lib/utilities';
import { sfdxTimeout } from './../helpers/testingUtils';

import {
  deployRequest,
  testRepo,
  poolOrg
} from '../../src/lib/types';
import { exec } from 'child_process';

const testDir = 'tmp'; // has to match what's expected by the parser
const deployId = 'testDepId';
const testFileLoc = `${testDir}/${deployId}`;
const testOrgInitLoc = `${testFileLoc}/orgInit.sh`;

const execProm = util.promisify(exec);

const timeOutLocalFS = 3000;

const testDepReqWL: deployRequest = {
  deployId,
  repo: 'testItOut',
  whitelisted: true,
  createdTimestamp: new Date()
};

const testDepReq: deployRequest = {
  deployId,
  repo: 'testItOut',
  whitelisted: false,
  createdTimestamp: new Date()
};

describe('lineParserLocalTests', () => {
  beforeAll(async () => {
    await fs.remove(testDir);
  });

  describe('whitelisted', () => {
    beforeEach(async () => {
      await fs.ensureDir(testFileLoc);
    });

    test('returns a basic one untouched', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = 'echo "hello world"';
      await fs.writeFile(testOrgInitLoc, fileContents);
      const parsedLines = await lineParse(testDepReqWL);
      expect(parsedLines.length).toBe(1);
      expect(parsedLines[0]).toBe(fileContents);
      // expect(parsedLines[0]).to.equal(fileContents);
    });

    test('properly removes comments', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = `
      echo "hello world"
      # says hello world`;
      await fs.writeFile(testOrgInitLoc, fileContents);
      const parsedLines = await lineParse(testDepReqWL);
      // expect(parsedLines).to.equal(Array(1).fill(fileContents));
      expect(parsedLines.length).toBe(1);
      expect(parsedLines[0]).toBe('echo "hello world"');
    });

    test('properly removes empty lines', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = `echo "hello world"


      # says hello world`;
      await fs.writeFile(testOrgInitLoc, fileContents);
      const parsedLines = await lineParse(testDepReqWL);
      // expect(parsedLines).to.equal(Array(1).fill(fileContents));
      expect(parsedLines.length).toBe(1);
      expect(parsedLines[0]).toBe('echo "hello world"');
    });

    test('adds json to sfdx commands', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = `
      echo "hello world"
      sfdx force:org:open`;
      await fs.writeFile(testOrgInitLoc, fileContents);
      const parsedLines = await lineParse(testDepReqWL);
      // expect(parsedLines).to.equal(Array(1).fill(fileContents));
      expect(parsedLines.length).toBe(2);
      expect(parsedLines[0]).toBe('echo "hello world"');
      expect(parsedLines[1]).toBe('sfdx force:org:open --json');
    });

    test('leaves non-sfdx commands untouched', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = `
      echo "hello world"
      something force:org:open`;
      await fs.writeFile(testOrgInitLoc, fileContents);
      const parsedLines = await lineParse(testDepReqWL);
      // expect(parsedLines).to.equal(Array(1).fill(fileContents));
      expect(parsedLines.length).toBe(2);
      expect(parsedLines[0]).toBe('echo "hello world"');
      expect(parsedLines[1]).toBe('something force:org:open');
    });

    afterEach(async () => {
      await fs.remove(testDir);
    });
  });

  describe('non-whitelisted', () => {
    beforeEach(async () => {
      await fs.ensureDir(testFileLoc);
    });

    test('throws error on shell sanitize issue', async () => {
      const fileContents = 'cat ../tmp > somewhereElse';
      await fs.writeFile(testOrgInitLoc, fileContents);
      //  await expect(deleteOrg('hack@you.bad;wget')).rejects.toEqual(Error('invalid username hack@you.bad;wget'));
      expect(lineParse(testDepReq)).rejects.toEqual(`ERROR: Commands with metacharacters cannot be executed.  Put each command on a separate line.  Your command: ${fileContents}`
      );
    });

    test('throws error with -u commands', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = 'sfdx force:org:open -u sneaky';
      await fs.writeFile(testOrgInitLoc, fileContents);
      expect(lineParse(testDepReq)).rejects.toEqual(
        `ERROR: Commands can't contain -u...you can only execute commands against the default project the deployer creates--this is a multitenant sfdx deployer.  Your command: ${fileContents}`
      );
    });

    test('throws error on non-sfdx commands', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = 'echo "hello world"';
      await fs.writeFile(testOrgInitLoc, fileContents);
      expect(lineParse(testDepReq)).rejects.toEqual(
        `ERROR: Commands must start with sfdx or be comments (security, yo!).  Your command: ${fileContents}`
      );
    });

    test('adds json to sfdx commands', async () => {
      // save a local orgIinit.sh in matching deploytId
      const fileContents = `sfdx force:source:push
      sfdx force:org:open`;
      await fs.writeFile(testOrgInitLoc, fileContents);
      const parsedLines = await lineParse(testDepReq);
      // expect(parsedLines).to.equal(Array(1).fill(fileContents));
      expect(parsedLines.length).toBe(2);
      expect(parsedLines[0]).toBe('sfdx force:source:push --json');
      expect(parsedLines[1]).toBe('sfdx force:org:open --json');
    });

    afterEach(async () => {
      await fs.remove(testDir);
    });
  });

  describe('everything in test repos', () => {
    
    jest.setTimeout(sfdxTimeout);

    beforeEach(async () => {
      await fs.ensureDir(testDir);
    });

    for (const prop in testRepos) {
      testRepos[prop].forEach((repo) => {
        const loopedDeployId = `test-${repo.username}-${repo.repo}`;
        const depReq: deployRequest = {
          whitelisted: true,
          deployId: loopedDeployId,
          repo: repo.repo,
          username: repo.username,
          createdTimestamp: new Date()
        };

        test(`tests ${repo.username}/${repo.repo}`, async () => {

          // git clone it
          const gitCloneCmd = utilities.getCloneCommand(depReq);
          await execProm(gitCloneCmd, { cwd: testDir});
          const parsedLines = await lineParse(depReq);
        });
      });
    }

    afterEach(async () => {
      await fs.remove(testDir);
    });
  });
});
