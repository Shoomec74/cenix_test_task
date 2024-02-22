const puppeteer = require('puppeteer');
const utils = require('./utils/utils'); // пользовательская функция для задержки выполнения
const path = require('path');
const {
  cleanString,
  writingToFile,
  waitforme,
  isElementVisible,
  addDirectory,
} = utils;

(async () => {
  const product = process.argv[2];
  const region = process.argv[3];

  if (!product || !region) {
    console.log('Необходимо указать адрес ссылки и регион.');
    console.log(
      'Пример использования: node index.js https://www.vprok.ru/product/domik-v-derevne-dom-v-der-moloko-ster-3-2-950g--309202 "Санкт-Петербург и область"',
    );
    process.exit(1);
  }

  const BASE_URL = 'https://www.vprok.ru/';

  const BASE_DIR_PATH = path.join(__dirname, 'base', region);

  const BASE_PRODUCT_INFO = path.join(BASE_DIR_PATH, 'product.txt');

  const BASE_ERROR_LOGS = path.join(BASE_DIR_PATH, 'errors.txt');

  const SELECT_REGION_SELECTOR = '//div[contains(@class, "Region_region")]';

  const PRICE_DISCOUNT_SELECTOR =
    '//div[contains(@class, "Buy_root")]//div[contains(@class, "PriceInfo_root")]//span[contains(@class, "Price_role_discount")]';

  const PRICE_OLD_SELECTOR =
    '//div[contains(@class, "Buy_root")]//div[contains(@class, "PriceInfo_root")]//span[contains(@class, "Price_role_old")] | //div[contains(@class, "Buy_root")]//div[contains(@class, "PriceInfo_root")]//span[contains(@class, "Price_role_regular")]';

  const PRICE_REGULAR_SELECTOR =
    '//div[contains(@class, "Buy_root")]//div[contains(@class, "PriceInfo_root")]//span[contains(@class, "Price_role_regular")]';

  const REVIEWS_BUTTON_SELECTOR =
    '//div[contains(@class, "ActionsRow_reviews")]//button[contains(@class, "ActionsRow_button")]';

  const RATING_COUNT_SELECTOR =
    '//div[contains(@class, "ActionsRow_stars")]//span[contains(@class, "Rating_value")]';

  const CLOSE_POPUP_BUTTON =
    '//div[contains(@class, "Tooltip_root")]//button[contains(@class, "Tooltip_closeIcon")]';

  const CURRENT_CITY_SELECTOR = `//li[contains(text(), "${region}")]`;

  const TITLE_PRODUCT_SELECTOR =
    '//article[contains(@class, "Summary_productContainer")]//h4[contains(@class, "Summary_productTitle")]';

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

  await addDirectory(BASE_DIR_PATH);

  const page = await browser.newPage();

  // Устанавливаем разрешение окна браузера, как у обычного пользователя
  await page.setViewport({ width: 1280, height: 800 });

  // Переходим на страницу
  await page.goto(BASE_URL);

  //ожидаем перезагрузки страницы браузера
  await page.waitForNavigation({ timeout: 10000 });

  console.log(`Сейчас начнется парсинг продуктов с города - ${region}`);

  //-- продолжаем нажимать на кнопку пока она видна --//
  let loadMoreVisible = await isElementVisible(
    page,
    `${typeSelector.pxPath}(${CLOSE_POPUP_BUTTON})`,
  );

  while (loadMoreVisible) {
    await page
      .click(`${typeSelector.pxPath}(${CLOSE_POPUP_BUTTON})`)
      .catch(() => {});
    loadMoreVisible = await isElementVisible(
      page,
      `${typeSelector.pxPath}(${CLOSE_POPUP_BUTTON})`,
    );
  }

  try {
    const selectRegionElement = await page.$(
      `${typeSelector.pxPath}(${SELECT_REGION_SELECTOR})`,
    );
    if (selectRegionElement) {
      await selectRegionElement.click();
    } else {
      await browser.close();
    }
  } catch (e) {
    console.log(`Не смогли перейти перейти к выбору региона`);
    console.error(e);
    await writingToFile(BASE_ERROR_LOGS, `${new Date()} - ${e.message}`);
  }

  await waitforme(3000);

  try {
    const regionElement = await page.$(
      `${typeSelector.pxPath}(${CURRENT_CITY_SELECTOR})`,
    );
    if (regionElement) {
      await regionElement.click();
    } else {
      await browser.close();
    }
  } catch (e) {
    console.log(`Не смогли выбрать регион - ${region}`);
    console.error(e);
    await writingToFile(BASE_ERROR_LOGS, `${new Date()} - ${e.message}`);
  }

  //await waitforme(3000);

  try {
    const selectRegionElement = await page.$(
      `${typeSelector.pxPath}(${SELECT_REGION_SELECTOR})`,
    );
    if (selectRegionElement) {
      await selectRegionElement.click();
    } else {
      await browser.close();
    }
  } catch (e) {
    console.log(`Не смогли перейти перейти к выбору региона`);
    console.error(e);
    await writingToFile(BASE_ERROR_LOGS, `${new Date()} - ${e.message}`);
  }

  await waitforme(3000);

  try {
    await Promise.all([page.waitForNavigation(), page.goto(product)]);

    const priceRegularElement = await page.$(
      `${typeSelector.pxPath}(${PRICE_REGULAR_SELECTOR})`,
    );

    const priceOldElements = await page.$(
      `${typeSelector.pxPath}(${PRICE_OLD_SELECTOR})`,
    );

    const priceDiscountElement = await page.$(
      `${typeSelector.pxPath}(${PRICE_DISCOUNT_SELECTOR})`,
    );

    const reviewsButtonElement = await page.$(
      `${typeSelector.pxPath}(${REVIEWS_BUTTON_SELECTOR})`,
    );

    const ratingCountElement = await page.$(
      `${typeSelector.pxPath}(${RATING_COUNT_SELECTOR})`,
    );

    const titleProductElement = await page.$(
      `${typeSelector.pxPath}(${TITLE_PRODUCT_SELECTOR})`,
    );

    const price = priceDiscountElement
      ? await page.evaluate((el) => el.textContent.trim(), priceDiscountElement)
      : await page.evaluate((el) => el.textContent.trim(), priceRegularElement);

    const reviewsCount = reviewsButtonElement
      ? await page.evaluate((el) => el.textContent.trim(), reviewsButtonElement)
      : null;

    const ratingCount = ratingCountElement
      ? await page.evaluate((el) => el.textContent.trim(), ratingCountElement)
      : null;

    const titleProduct = titleProductElement
      ? await page.evaluate((el) => el.textContent.trim(), titleProductElement)
      : null;

    const priceOld = priceOldElements
      ? await page.evaluate((el) => el.textContent.trim(), priceOldElements)
      : null;

    const safeRegion = region.replace(/[^a-zA-Z0-9а-яА-Я]/g, ''); // Удаляем все символы, кроме букв и цифр
    const safeTitleProduct = titleProduct.replace(/[^a-zA-Z0-9а-яА-Я]/g, ''); // Удаляем все символы, кроме букв и цифр

    const screenshotPath = path.join(
      BASE_DIR_PATH,
      `${safeRegion}_${safeTitleProduct}_screenshot.jpeg`,
    );

    await page.screenshot({
      path: screenshotPath,
      type: 'jpeg',
      quality: 100,
      fullPage: true,
    });

    const productInfo = `titleProduct ${titleProduct}\nprice ${await cleanString(price)}\npriceOld ${await cleanString(priceOld ? priceOld : 'скидок нет')}\nrating ${await cleanString(ratingCount)}\nreviewCount ${await cleanString(reviewsCount)}\n`;

    await writingToFile(BASE_PRODUCT_INFO, productInfo);
  } catch (e) {
    console.log(`Не смогли перейти к выбору региона`);
    console.error(e);
    await writingToFile(BASE_ERROR_LOGS, `${new Date()} - ${e.message}`);
  }

  await browser.close();
})().catch((e) => console.error(e));
