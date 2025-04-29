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

    //   Change The Number to extract data from multiple pages ----------------------

    const maxPages = 2;
    let allCars = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const url = `https://www.cars.com/shopping/results/?page=${pageNum}`;
        console.log(` Visiting page ${pageNum} -> ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 0,
        });

        await autoScroll(page);
        await new Promise(resolve => setTimeout(resolve, 3000));

        const cars = await page.evaluate(() => {
            const listings = Array.from(document.querySelectorAll('.vehicle-card'));
            return listings.map(car => {
                const title = car.querySelector('h2')?.innerText || '';
                const price = car.querySelector('.primary-price')?.innerText || '';
                const mileage = car.querySelector('.mileage')?.innerText || '';
                const dealer = car.querySelector('.dealer-name')?.innerText || '';
                const image = car.querySelector('.vehicle-card img')?.src || '';
                const link = car.querySelector('a')?.href || '';
                return { title, price, mileage, dealer, image, link };
            });
        });

        console.log(`Found ${cars.length} cars on page ${pageNum}`);
        allCars.push(...cars);
    }

    await browser.close();

    fs.writeFileSync('cars-data.json', JSON.stringify(allCars, null, 2));
    console.log(`Done! Total cars scraped: ${allCars.length}`);
})();
