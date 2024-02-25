const puppeteer = require('puppeteer');
const utils = require('../utils/utils.js'); // пользовательская функция для задержки выполнения

const { addDirectory, cleanString, writingToFile } = utils;

process.on('message', async (msg) => {
  const { browserWSEndpoint, url, workerName, dataPath, pid } = msg;

  await addDirectory(dataPath);

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

  const TITLE_PRODUCT_SELECTOR =
    '//article[contains(@class, "Summary_productContainer")]//h4[contains(@class, "Summary_productTitle")]';

  const OUT_OF_STOCK = '//div[contains(@class, "OutOfStockInformer")]';

  const typeSelector = {
    pText: '::-p-text',
    pxPath: '::-p-xpath',
    pAria: '::-p-aria',
    pGetById: '::-p-getById',
  };

  let browser;

  try {
    //-- TODO: Добавить запуск отдельной страницы в случае если данный воркер завершился ошибкой например если task тогда... --//
    browser = await puppeteer.connect({ browserWSEndpoint });

    const pages = await browser.pages();

    const page = pages[0];

    await page.setViewport({ width: 1280, height: 800 });

    try {
      const outOfStockElement = await page.$(
        `${typeSelector.pxPath}(${OUT_OF_STOCK})`,
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

      const ratingCount = ratingCountElement
        ? await page.evaluate((el) => el.textContent.trim(), ratingCountElement)
        : 'Рейтинг отсутствует';

      const titleProduct = titleProductElement
        ? await page.evaluate(
            (el) => el.textContent.trim(),
            titleProductElement,
          )
        : 'Название продукта не найдено';

      const reviewsCount = reviewsButtonElement
        ? await page.evaluate(
            (el) => el.textContent.trim(),
            reviewsButtonElement,
          )
        : 'Отзывы отсутствуют';

      let productInfo;

      if (outOfStockElement) {
        // Если товара нет в наличии, заполняем данные сразу, не ищем остальное
        productInfo = `title ${titleProduct}\nprice Товара нет в наличии\npriceOld Товара нет в наличии\nrating ${await cleanString(ratingCount)}\nreviewCount ${await cleanString(reviewsCount)}\n`;
      } else {
        // Ищем остальные элементы только если товар в наличии
        const priceRegularElement = await page.$(
          `${typeSelector.pxPath}(${PRICE_REGULAR_SELECTOR})`,
        );
        const priceOldElements = await page.$(
          `${typeSelector.pxPath}(${PRICE_OLD_SELECTOR})`,
        );
        const priceDiscountElement = await page.$(
          `${typeSelector.pxPath}(${PRICE_DISCOUNT_SELECTOR})`,
        );

        const price = priceDiscountElement
          ? await page.evaluate(
              (el) => el.textContent.trim(),
              priceDiscountElement,
            )
          : priceRegularElement
            ? await page.evaluate(
                (el) => el.textContent.trim(),
                priceRegularElement,
              )
            : 'Цена не указана';

        const priceOld = priceOldElements
          ? await page.evaluate((el) => el.textContent.trim(), priceOldElements)
          : 'Скидок нет';

        productInfo = `title ${titleProduct}\nprice ${await cleanString(price)}\npriceOld ${await cleanString(priceOld)}\nrating ${await cleanString(ratingCount)}\nreviewCount ${await cleanString(reviewsCount)}\n`;
      }

      await writingToFile(`${dataPath}/product.txt`, productInfo);
    } catch (e) {
      await browser.disconnect();
      console.error(e);
      process.send({
        payload: {
          workerName: workerName,
          type: 'error',
          message: `Произошла ошибка при попытке получить данные о продукте: ${JSON.stringify(e)}`,
          code: 424,
          url: url,
        },
      });

      try {
        process.kill(+pid, 'SIGTERM');
        console.log(`Процесс с PID ${pid} был успешно завершен.`);
      } catch (err) {
        console.error(`Ошибка при завершении процесса с PID ${pid}:`, err);
      }
    }

    await browser.disconnect();

    process.send({
      payload: {
        workerName: workerName,
        status: 'ok',
        code: 200,
      },
    });
  } catch (e) {
    browser.disconnect();
    console.error(e);
    process.send({
      payload: {
        type: 'error',
        workerName: workerName,
        message: `Произошла ошибка при подключении к браузеру или открытии страницы: ${JSON.stringify(e)}`,
        code: 424,
        url: url,
      },
    });

    try {
      process.kill(+pid, 'SIGTERM');
      console.log(`Процесс с PID ${pid} был успешно завершен.`);
    } catch (err) {
      console.error(`Ошибка при завершении процесса с PID ${pid}:`, err);
    }
  }
});
