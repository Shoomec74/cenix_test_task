const vorpal = require('vorpal')();
const { fork } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config('../.env');

const {
  SCREENSHOT_WORKER_NAME,
  BROWSER_WORKER_NAME,
  BASE_DIR_ASSETS,
  BASE_DIR_WORKERS,
  SCRAPING_WORKER_NAME,
  REGION_CODES,
} = process.env;

const BASE_PATH = path.join(__dirname);

const WORKERS_BASE_PATH = path.join(BASE_PATH, BASE_DIR_WORKERS);

const ASSETS_BASE_PATH = path.join(BASE_PATH, BASE_DIR_ASSETS);

const WORKERS = {};

//-- Определение команды для Vorpal CLI --//
vorpal
  .command(
    'parse <url> <region>',
    'Starts parsing with the provided URL and region.',
  )
  .action(function (args, callback) {
    const regionCodes = JSON.parse(REGION_CODES);
    //-- Создание воркера для обработки браузера и отправка ему начальных данных --//
    createWorker(
      'browserWorker.js',
      (msg) => handlerMessagesrWorker(msg, callback),
      (err) => {
        console.error(`Browser Worker error: ${err}`);
        callback();
      },
      (code) => {
        console.log(`${BROWSER_WORKER_NAME} exited with code ${code}`);
      },
      BROWSER_WORKER_NAME,
    );
    //-- Отправка данных для воркеру браузера --//
    WORKERS[BROWSER_WORKER_NAME].send({
      workerName: BROWSER_WORKER_NAME,
      regionCodes: regionCodes,
      url: args.url,
      region: args.region,
      pid: WORKERS[BROWSER_WORKER_NAME].pid,
    });
  });

vorpal
  .catch('[words...]', 'Catches incorrect commands')
  .action(function (args, callback) {
    this.log('Вы ввели команду, которая не может быть обработана.');
    this.log(
      'Убедитесь, что вы заключили в кавычки регион например вот так - "Москва и область"',
    );
    callback();
  });

vorpal.delimiter('vprokParser$').parse(process.argv);

//-- Функция обработки сообщений от воркеров --//
function handlerMessagesrWorker(msg, callback) {
  const { payload } = msg;
  //-- кастомный обработчик ошибок от воркеров для перезапуска или прочих тасок --//
  if (payload.type === 'error') {
    handlerErrorsWorker(msg, callback);
    return;
  }
  switch (payload.workerName) {
    case BROWSER_WORKER_NAME:
      if (payload.code === 200) {
        //-- Создание воркера для скриншотов и отправка ему данных --//
        createWorker(
          'screenshotWorker.js',
          (msg) => handlerMessagesrWorker(msg, callback),
          (err) => {
            console.error(`Screenshot Worker error: ${err}`), callback();
          },
          (code) => {
            console.log(`${SCREENSHOT_WORKER_NAME} exited with code ${code}`);
          },
          SCREENSHOT_WORKER_NAME,
        );

        const BASE_SCREENHOTS_PATH = path.join(
          ASSETS_BASE_PATH,
          payload.region,
        );

        WORKERS[SCREENSHOT_WORKER_NAME].send({
          browserWSEndpoint: payload.wsEndpoint,
          workerName: SCREENSHOT_WORKER_NAME,
          url: payload.url,
          region: payload.region,
          screenshotsPath: BASE_SCREENHOTS_PATH,
          pid: WORKERS[SCREENSHOT_WORKER_NAME].pid,
        });
      } else if (payload.code === 201) {
        console.log(`Скриншот и данные успешно собраны`);
        process.exit(0);
      } else {
        console.log(
          `Необработанное сообщение от воркера ${BROWSER_WORKER_NAME} статуса - ${msg}`,
        );
      }
      break;
    case SCREENSHOT_WORKER_NAME:
      if (payload.code === 200) {
        //-- Логика обработки после скриншот воркера и создание воркера для скрапинга --//
        createWorker(
          'scrapingWorker.js',
          (msg) => handlerMessagesrWorker(msg, callback),
          (err) => {
            console.error(`Screenshot Worker error: ${err}`), callback();
          },
          (code) => {
            console.log(`${SCRAPING_WORKER_NAME} exited with code ${code}`);
          },
          SCRAPING_WORKER_NAME,
        );

        const BASE_PRODUCT_DATA_PATH = path.join(
          ASSETS_BASE_PATH,
          payload.region,
        );

        WORKERS[SCRAPING_WORKER_NAME].send({
          browserWSEndpoint: payload.browserWSEndpoint,
          workerName: SCRAPING_WORKER_NAME,
          url: payload.url,
          dataPath: BASE_PRODUCT_DATA_PATH,
          pid: WORKERS[SCRAPING_WORKER_NAME].pid,
        });
      } else {
        console.log(
          `необработанное сообщение от воркера ${SCREENSHOT_WORKER_NAME} статуса - ${msg}`,
        );
      }
      break;
    case SCRAPING_WORKER_NAME:
      if (payload.code === 200) {
        //-- Завершием выполнение скрипта и выключаем браузер--//
        WORKERS[BROWSER_WORKER_NAME].send({
          workerName: BROWSER_WORKER_NAME,
          exit: true,
          pid: WORKERS[BROWSER_WORKER_NAME].pid,
        });
      } else {
        console.log(
          `необработанное сообщение от воркера ${SCRAPING_WORKER_NAME} статуса - ${msg}`,
        );
      }
      break;
    default:
      console.log('Неизвестный тип воркера:', msg.worker);
  }
}

function handlerErrorsWorker(msg, callback) {
  const { payload } = msg;
  switch (payload.workerName) {
    case BROWSER_WORKER_NAME:
      console.log(
        `Ошибка в воркере ${BROWSER_WORKER_NAME}. Информация для дебага:`,
        payload.message,
      );
      //--Место для логики перезапуска или других действий. Пока что просто завершаем выполнение--//
      callback();
      break;
    case SCREENSHOT_WORKER_NAME:
      console.log(
        `Ошибка в воркере ${SCREENSHOT_WORKER_NAME}. Информация для дебага:`,
        payload.message,
      );
      //--Место для логики перезапуска или других действий--//
      callback();
      break;
    case SCRAPING_WORKER_NAME:
      console.log(
        `Ошибка в воркере ${SCRAPING_WORKER_NAME}. Информация для дебага:`,
        payload.message,
      );
      //--Место для логики перезапуска или других действий--//
      callback();
      break;
    default:
      console.log(`Неведомая ошибка`);
      callback();
      break;
  }
}

function createWorker(
  workerPath,
  messageHandler,
  errorHandler,
  exitHandler,
  name,
) {
  const fullWorkerPath = path.join(WORKERS_BASE_PATH, workerPath);
  const worker = fork(fullWorkerPath);
  WORKERS[name] = worker;

  console.log(`Запущен воркер c именем ${name} с PID: ${worker.pid}`);

  worker.on('message', messageHandler);
  worker.on('error', errorHandler);
  worker.on('exit', exitHandler);

  return worker;
}
