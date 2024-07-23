import { ChromiumBrowser, chromium } from "playwright";

interface Match {
  id: number;
  title: string;
  url: string;
}

async function getMatches(browser: ChromiumBrowser): Promise<Match[]> {
  const page = await browser.newPage();
  await page.goto('https://www.pelotalibretv.com/agenda.html');
  await page.waitForSelector('div[id="wraper"]');

  const results: Match[] = await page.evaluate(() => {
    const matches: Match[] = [];
    const links: string[] = [];

    document.querySelectorAll<HTMLAnchorElement>('ul[class="menu"] li ul li a').forEach((a, index) => {
      links.push(a.href);
    });

    document.querySelectorAll<HTMLLIElement>('ul[class="menu"] li').forEach((li, index) => {
      if (!li.innerText.includes('0p')) {
        matches.push({
          id: index,
          title: li.innerText,
          url: links[index]
        });
      }
    });

    return matches;
  });

  return results;
}

interface UrlObject {
  url: string;
}

async function getLink(url: UrlObject, browser: ChromiumBrowser): Promise<string> {
  const page = await browser.newPage();
  if (url.url === undefined) {
    return 'no link yet'
  } else {
    await page.goto(url.url)
  }
  await page.waitForSelector('div[class="container"]');

  const results: string = await page.evaluate(() => {
    const iframeElement = document.querySelector<HTMLIFrameElement>('div[class="embed-responsive embed-responsive-16by9"] iframe');
    return iframeElement ? iframeElement.outerHTML : '';
  });

  return results;
}

export async function getData() {
  const browser = await chromium.launch()
  const matches = await getMatches(browser)
  let links = []

  for await (const match of matches) {
    const contenido = await getLink(match, browser)

    links.push({
      id: match.id,
      title: match.title,
      iframe: contenido
    })
  }
  
  // console.log(links)
  
  await browser.close()
  return links
}
