const puppeteer = require('puppeteer');
const utils = require('./utils/utils'); // пользовательская функция для задержки выполнения
const path = require('path');

(async () => {
  const BASE_URL = 'https://www.vprok.ru/';
  const BASE_CITIES_PATH = path.join(__dirname, 'base', 'base_cities.txt');
  const BASE_PRODUCTIONS_PATH = path.join(
    __dirname,
    'base',
    'base_products.txt',
  );
  const BASE_ERROR_LOGS = path.join(__dirname, 'base', 'errors.txt');

  const typeSelector = {
    pText: '::-p-text',
    pxPath: '::-p-xpath',
    pAria: '::-p-aria',
    pGetById: '::-p-getById',
  };

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
  await page.goto(BASE_URL);

  //ожидаем перезагрузки страницы браузера
  await page.waitForNavigation({ timeout: 10000 });

  const SELECT_REGION_SELECTOR = '//div[contains(@class, "Region_region")]';

  const cityCount = await utils.countLines(BASE_CITIES_PATH);

  //--Создаем массивы, чтобы иметь доступ к асинхронной версии for и итерироваться по списку городов и продуктов--//
  const arrCityForIterable = await utils.createLightweightArray(cityCount);

  // eslint-disable-next-line no-unused-vars
  for await (const iter of arrCityForIterable) {
    let products = await utils.getLinesFile(BASE_PRODUCTIONS_PATH);
    let count = 0;

    const currrentCity = (
      await utils.getLinesAndRewriteFile(BASE_CITIES_PATH, 1)
    ).trim();

    console.log(`Сейчас начнется парсинг продуктов с города - ${currrentCity}`);

    try {
      // Используйте page.$x для выполнения XPath запроса
      const selectRegionElement = await page.$(
        `${typeSelector.pxPath}(${SELECT_REGION_SELECTOR})`,
      );
      if (selectRegionElement) {
        // Если элемент найден, выполните клик по нему
        await selectRegionElement.click();
      } else {
        await browser.close();
      }
    } catch (e) {
      console.log(`Не смогли перейти перейти к выбору региона`);
      console.error(e);
      await utils.writingToFile(
        BASE_ERROR_LOGS,
        `${new Date()} - ${e.message}`,
      );
    }

    //await page.waitForNavigation({ timeout: 10000 });
    await utils.waitforme(3000);

    const CURRENT_CITY_SELECTOR = `//li[contains(text(), "${currrentCity}")]`;

    try {
      const regionElement = await page.$(
        `${typeSelector.pxPath}(${CURRENT_CITY_SELECTOR})`,
      );
      if (regionElement) {
        // Если элемент найден, выполните клик по нему
        await regionElement.click();
      } else {
        await browser.close();
      }
    } catch (e) {
      console.log(`Не смогли выбрать регион - ${currrentCity}`);
      console.error(e);
      await utils.writingToFile(
        BASE_ERROR_LOGS,
        `${new Date()} - ${e.message}`,
      );
    }

    await utils.waitforme(3000);

    // eslint-disable-next-line no-unused-vars
    while (products !== null) {
      const res = await utils.getElementsFromArray(products, 15);
      console.log(res.cutElements);
      if (res === null) {
        products = null;
        return;
      }
      products = res.cutArray;
      const pages = await Promise.all(
        // eslint-disable-next-line no-unused-vars
        res.cutElements.map((url) => {
          return browser.newPage();
        }),
      ); // Открытие вкладок для каждого продукта

      await Promise.all(
        pages.map(async (page, index) => {
          page.waitForNavigation();
          // console.log(res.cutElements[index]);
          const productUrl = res.cutElements[index];
          await page.goto(productUrl); // Переход на страницу продукта
          await utils.waitforme(3000); // Ожидание 10 секунд
          try {
            await page.screenshot({
              path: `${count++}_${currrentCity}_screenshot.jpeg`,
              type: 'jpeg',
              quality: 100,
              fullPage: true,
            });
          } catch (e) {
            console.log(
              `Не смогли сделать скриншот на странице товара - ${res.cutElements[index]}`,
            );
            console.error(e);
            await utils.writingToFile(
              BASE_ERROR_LOGS,
              `${new Date()} - ${e.message}`,
            );
          }
          await page.close(); // Закрытие вкладки
        }),
      );
    }
  }
  await browser.close();
})().catch((e) => console.error(e));

// let productsCount = [];

// for await (const iter of arrProductsForIterable) {
//   const currentUrlProduct = await utils.getFirstLineAndRewriteFile(
//     BASE_PRODUCTIONS_PATH,
//   );

//   await page.goto(currentUrlProduct, { waitUntil: 'networkidle2' });

//   await utils.waitforme(5000);

// try {
//   await page.screenshot({
//     path: `${count++}_screenshot.jpeg`,
//     type: 'jpeg',
//     quality: 100,
//     fullPage: true,
//   });
// } catch (e) {
//   console.log(
//     `Не смогли сделать скриншот на странице товара - ${currentUrlProduct}`,
//   );
//   console.error(e);
//   await utils.writingToFile(BASE_ERROR_LOGS, `${new Date()} - ${e.message}`);
// }
