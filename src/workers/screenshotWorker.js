const puppeteer = require('puppeteer');
const utils = require('../utils/utils.js');

const { isElementVisible, addDirectory } = utils;

process.on('message', async (msg) => {
  const { browserWSEndpoint, url, workerName, screenshotsPath, region, pid } =
    msg;

  await addDirectory(screenshotsPath);

  const typeSelector = {
    pText: '::-p-text',
    pxPath: '::-p-xpath',
    pAria: '::-p-aria',
    pGetById: '::-p-getById',
  };

  const CLOSE_POPUP_BUTTON =
    '//div[contains(@class, "Tooltip_root")]//button[contains(@class, "Tooltip_closeIcon")]';

  const COOCKIE_BLOCK =
    '//div[contains(@id, "bottomPortal") and contains(@class, "FeatureAppLayoutBase_bottomPortal")]';

  let browser;

  try {
    browser = await puppeteer.connect({ browserWSEndpoint });

    const pages = await browser.pages();
    const page = pages[0];

    page.setDefaultNavigationTimeout(60000);

    await page.goto(url, { waitUntil: 'networkidle0' });

    await page.waitForNavigation();

    const bodyHandle = await page.$('body');
    const { height } = await bodyHandle.boundingBox();
    await page.setViewport({ width: 1280, height: Math.round(height) });
    await bodyHandle.dispose();

    let loadMoreVisible = await isElementVisible(
      page,
      `${typeSelector.pxPath}(${CLOSE_POPUP_BUTTON})`,
    );

    while (loadMoreVisible.length > 0) {
      for await (const selector of loadMoreVisible) {
        await page.click(selector).catch(() => {});
      }
      loadMoreVisible = await isElementVisible(
        page,
        `${typeSelector.pxPath}(${CLOSE_POPUP_BUTTON})`,
      );
    }

    const cockieBlock = await page.$(
      `${typeSelector.pxPath}(${COOCKIE_BLOCK})`,
    );

    if (cockieBlock) {
      await page.evaluate((el) => el.remove(), cockieBlock);
      cockieBlock.dispose();
    }

    try {
      const pageTitle = (await page.title()).split('-')[0];

      await page.screenshot({
        path: `${screenshotsPath}/${pageTitle.replace(/[<>:"/\\|?*]/, '')}_screensot.jpg`,
        type: 'jpeg',
        quality: 200,
        fullPage: true,
      });

      process.send({
        payload: {
          workerName: workerName,
          status: 'ok',
          code: 200,
          url: url,
          region: region,
          screenshotsPath: screenshotsPath,
          browserWSEndpoint: browserWSEndpoint,
        },
      });

      await browser.disconnect();

      try {
        process.kill(+pid, 'SIGTERM');
        console.log(`Процесс с PID ${pid} был успешно завершен.`);
      } catch (err) {
        console.error(`Ошибка при завершении процесса с PID ${pid}:`, err);
      }
    } catch (e) {
      await browser.disconnect();
      console.error(e);
      process.send({
        payload: {
          workerName: workerName,
          type: 'error',
          message: `Ошибка создания скриншота страницы - ${url}, региона - ${region}, текст ошибки - ${JSON.stringify(e)}`,
          code: 424,
          url: url,
          region: region,
        },
      });

      try {
        process.kill(+pid);
        console.log(`Процесс с PID ${pid} был успешно завершен.`);
      } catch (err) {
        console.error(`Ошибка при завершении процесса с PID ${pid}:`, err);
      }
    }
  } catch (e) {
    await browser.disconnect();
    process.send({
      payload: {
        workerName: workerName,
        type: 'error',
        message: `Ошибка перехода на страницу - ${url} или поиска селектора, регион - ${region}, текст ошибки - ${JSON.stringify(e)}`,
        code: 424,
        url: url,
        region: region,
      },
    });
    console.error(e);

    try {
      process.kill(+pid, 'SIGTERM');
      console.log(`Процесс с PID ${pid} был успешно завершен.`);
    } catch (err) {
      console.error(`Ошибка при завершении процесса с PID ${pid}:`, err);
    }
  }
});
