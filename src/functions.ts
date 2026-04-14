import { ChromiumBrowser, chromium } from "playwright";

interface Match {
  id: number;
  title: string;
  url: string;
  time?: string;
  country?: string;
  streams?: Stream[];
}

interface Stream {
  name: string;
  url: string;
}

async function getMatches(browser: ChromiumBrowser): Promise<Match[]> {
  const page = await browser.newPage();
  await page.goto('https://pelotalibres.net');
  
  // Wait for the wraper and then wait a bit more for dynamic content
  await page.waitForSelector('div[id="wraper"]');
  await page.waitForTimeout(5000); // Wait for dynamic content

  const results: Match[] = await page.evaluate(() => {
    const matches: Match[] = [];
    
    // Get all the main menu items (the matches)
    const menuItems = document.querySelectorAll('#menu li.toggle-submenu');
    
    menuItems.forEach((li, index) => {
      try {
        // Extract time from the time element
        const timeElement = li.querySelector('time[datetime]');
        const time = timeElement ? timeElement.textContent?.trim() : '';
        
        // Extract country from the img alt attribute
        const countryImg = li.querySelector('div:first-child img');
        const country = countryImg ? countryImg.getAttribute('alt') || '' : '';
        
        // Extract title from the span
        const titleSpan = li.querySelector('div:first-child span');
        const title = titleSpan ? titleSpan.textContent?.trim() : '';
        
        // Extract all stream links from the submenu
        const streams: Stream[] = [];
        const streamLinks = li.querySelectorAll('.submenu a');
        
        streamLinks.forEach((a) => {
          const streamName = a.querySelector('span')?.textContent?.trim() || '';
          const streamUrl = a.getAttribute('href') || '';
          
          if (streamName && streamUrl) {
            streams.push({
              name: streamName,
              url: streamUrl
            });
          }
        });
        
        if (title && !title.includes('0p')) {
          matches.push({
            id: index,
            title: title,
            url: streams.length > 0 ? streams[0].url : '', // Use first stream as main URL
            time: time,
            country: country,
            streams: streams
          });
        }
      } catch (error) {
        console.log('Error processing menu item:', error);
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
  
  if (!url.url || url.url === '') {
    return 'no link available'
  }
  
  try {
    // Construct full URL if it's a relative path
    const fullUrl = url.url.startsWith('http') ? url.url : `https://pelotalibres.net${url.url}`;
    await page.goto(fullUrl);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    const results: string = await page.evaluate(() => {
      // Try multiple iframe selectors
      const iframeSelectors = [
        'div[class*="embed-responsive"] iframe',
        'iframe[src*="stream"]',
        'iframe[src*="player"]',
        'iframe[src*="embed"]',
        'iframe'
      ];
      
      for (const selector of iframeSelectors) {
        const iframeElement = document.querySelector<HTMLIFrameElement>(selector);
        if (iframeElement && iframeElement.src) {
          return iframeElement.outerHTML;
        }
      }
      
      // If no iframe found, look for any video elements
      const videoElement = document.querySelector('video');
      if (videoElement) {
        return videoElement.outerHTML;
      }
      
      // Look for script tags that might contain stream URLs
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('stream') || content.includes('player') || content.includes('iframe')) {
          return `<script>Found potential stream data in script</script>`;
        }
      }
      
      return 'no iframe or video found';
    });

    return results;
  } catch (error) {
    console.log('Error getting link:', error);
    return `error: ${error instanceof Error ? error.message : 'unknown error'}`;
  } finally {
    await page.close();
  }
}

export async function getData() {
  const browser = await chromium.launch({ headless: true })
  
  try {
    const matches = await getMatches(browser);
    let links = [];

    for await (const match of matches) {
      // Try to get iframe from the first stream
      let iframeContent = 'no iframe available';
      if (match.streams && match.streams.length > 0) {
        const firstStream = match.streams[0];
        iframeContent = await getLink({ url: firstStream.url }, browser);
      }
      
      links.push({
        id: match.id,
        title: match.title,
        time: match.time,
        country: match.country,
        streams: match.streams,
        iframe: iframeContent
      });
    }
    
    return links;
  } catch (error) {
    throw error;
  } finally {
    await browser.close();
  }
}