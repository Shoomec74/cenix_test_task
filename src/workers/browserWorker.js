const puppeteer = require('puppeteer');

process.on('message', async (msg) => {
  const NAME_COOKIE_REGION = 'region';
  const COOKIE_DOMAIN = '.vprok.ru';
  const { url, region, regionCodes, workerName, exit, pid } = msg;

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: [
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36`, // Установка пользовательского агента
    ],
  });

  if (exit) {
    browser.close();
    process.send({
      payload: {
        workerName: workerName,
        code: 201,
      },
    });
  }

  const code = getCodeByRegionName(regionCodes, region, workerName, pid);

  const browserWSEndpoint = browser.wsEndpoint();

  try {
    const pages = await browser.pages();

    const page = pages[0];

    await page.setCookie({
      name: NAME_COOKIE_REGION,
      value: `${code}`,
      domain: COOKIE_DOMAIN,
    });

    process.send({
      payload: {
        workerName: workerName,
        status: 'ok',
        wsEndpoint: `${browserWSEndpoint}`,
        code: 200,
        url: url,
        region: region,
      },
    });
  } catch (e) {
    await browser.close();

    process.send({
      payload: {
        workerName: workerName,
        type: 'Error',
        message: 'Failed Dependency',
        code: 424,
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

function getCodeByRegionName(regions, regionName, workerName, pid) {
  for (let key in regions) {
    if (regions[key].name === regionName) {
      return regions[key].code;
    }
  }

  process.send({
    payload: {
      workerName: workerName,
      type: 'Error',
      message: 'badConfig',
      code: 400,
    },
  });

  try {
    process.kill(+pid, 'SIGTERM');
    console.log(`Процесс с PID ${pid} был успешно завершен.`);
  } catch (err) {
    console.error(`Ошибка при завершении процесса с PID ${pid}:`, err);
  }
}
