const puppeteer = require('puppeteer');
const waitforme = require('./utils/utils'); // пользовательская функция для задержки выполнения

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Запуск браузера в режиме с графическим интерфейсом
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36`, // Установка пользовательского агента
    ],
  });

  const page = await browser.newPage();

  // Устанавливаем разрешение окна браузера, как у обычного пользователя
  await page.setViewport({ width: 1280, height: 800 });

  // Переходим на страницу
  await page.goto('https://www.vprok.ru/', { waitUntil: 'networkidle2' });

  await waitforme(10000);

  const SELECT_REGION_SELECTOR =
    '//span[contains(@class, "Region_regionIcon")]';
  const element = await page.waitForSelector(
    `::-p-xpath(${SELECT_REGION_SELECTOR})`,
  );

  await element.click();

  console.log(element);
})();
