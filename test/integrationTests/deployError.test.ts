import * as fs from 'fs-extra';
import * as puppeteer from 'puppeteer';

import { getTestURL } from '../helpers/testingUtils';
import { sfdxTimeout } from '../helpers/testingUtils';

const tmpDir = 'deployErrorTestTmpDir';

const testUrl = getTestURL();

beforeAll(async () => {
	await fs.remove(tmpDir);
	fs.ensureDirSync(tmpDir);
});

describe('tests error handling', () => {
	// something about a repo that ain't there
	test('fails to deploy a bad repo, with good error messages', async () => {
        
        jest.setTimeout(sfdxTimeout);
        
        const browser = await puppeteer.launch({});
		const page = await browser.newPage();

		const user = 'mshanemc';
		const repo = 'this-aint-nothin';
		const url = `https://github.com/${user}/${repo}`;

		await page.goto(`${testUrl}/launch?template=${url}`);
		const urlResult = await page.url();

		expect(urlResult).toContain(`deploying/deployer/${user}-${repo}-`);
		try {
			await page.waitForSelector('div#errorBlock', {timeout: sfdxTimeout});
		} catch (error) {
			console.error('error message did not appear');
		}
		browser.close();
	});
});


afterAll(async () => {
	await fs.remove(tmpDir);
	// await clearQueues();
});
