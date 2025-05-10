const puppeteer = require('puppeteer');
const fs = require('fs');

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const delay = 1000;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    slowMo: 50,
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 4000,
    deviceScaleFactor: 0.5,
  });

  // You can increase this to scrape more pages
   const maxPages = 2;
  // select how much cars u want from per page----
  const MAX_CARS_PER_PAGE = 6; 
  let allCars = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = `https://www.cars.com/shopping/results/?page=${pageNum}`;
    console.log(` Visiting listing page ${pageNum} -> ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0,
    });

    await autoScroll(page);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const cars = await page.evaluate((limit) => {
      const listings = Array.from(document.querySelectorAll('.vehicle-card'));
      return listings.slice(0, limit).map((car) => {
        const title = car.querySelector('h2')?.innerText || '';
        const price = car.querySelector('.primary-price')?.innerText || '';
        const dealer = car.querySelector('.dealer-name')?.innerText || '';
        const image = car.querySelector('.vehicle-card img')?.src || '';
        const link = car.querySelector('a')?.href || '';
        return { title, price, mileage, dealer, image, link };
      });
    }, MAX_CARS_PER_PAGE);

    console.log(` Found ${cars.length} cars on page ${pageNum}`);

    for (const [index, car] of cars.entries()) {
      console.log(`(${index + 1}/${cars.length}) Visiting car details: ${car.link}`);

      try {
        await page.goto(car.link, {
          waitUntil: 'networkidle2',
          timeout: 0,
        });

        await autoScroll(page);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const details = await page.evaluate(() => {
          const getDetail = (label) => {
            const dtElements = Array.from(document.querySelectorAll('.fancy-description-list dt'));
            const dt = dtElements.find(
              (el) => el.innerText.trim().toLowerCase() === label.toLowerCase()
            );
            return dt ? dt.nextElementSibling?.innerText.trim() : '';
          };

          const imageEl =
            document.querySelector('img[src*="inventory"]') ||
            document.querySelector('.image-gallery img') ||
            document.querySelector('img[alt*="vehicle"]');

          return {
            vin: getDetail('VIN'),
            engine: getDetail('Engine'),
            fuelType: getDetail('Fuel Type'),
            transmission: getDetail('Transmission'),
            exteriorColor: getDetail('Exterior Color'),
            interiorColor: getDetail('Interior Color'),
            stock: getDetail('Stock #'),
            detailedMileage: getDetail('Mileage'),
            drivetrain: getDetail('Drivetrain'),
          };
        });

        Object.assign(car, details);
      } catch (err) {
        console.error(`Error visiting ${car.link}:`, err.message);
      }
    }

    allCars.push(...cars);
  }

  await browser.close();

  fs.writeFileSync('cars-data.json', JSON.stringify(allCars, null, 2));
  console.log(`Done! Total cars scraped with details: ${allCars.length}`);
})();



