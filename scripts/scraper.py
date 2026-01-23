"""
Eventbrite Toronto Workshop Scraper
Scrapes workshop events from Eventbrite Toronto search results page.
"""

import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime
import time


def setup_driver():
    """Setup and return a headless Chrome WebDriver."""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def extract_event_data(driver, card_element):
    """
    Extract event data from a single event card element.
    Returns a dictionary with event information or None if extraction fails.
    """
    event_data = {
        'Title': '',
        'Date': '',
        'Location': '',
        'Link': '',
        'Image_URL': '',
        'Organizer': ''
    }
    
    try:
        # Extract Title - try multiple selectors
        title_selectors = [
            ".event-card__title a",
            "h2 a",
            ".event-card__title",
            "a[data-testid='event-title']",
            "h3 a",
            ".event-title a"
        ]
        for selector in title_selectors:
            try:
                title_elem = card_element.find_element(By.CSS_SELECTOR, selector)
                event_data['Title'] = title_elem.text.strip()
                # Also extract link from title if available
                if not event_data['Link']:
                    try:
                        event_data['Link'] = title_elem.get_attribute('href') or ''
                    except:
                        pass
                if event_data['Title']:
                    break
            except:
                continue
        
        # Extract Link - try multiple selectors if not already found
        if not event_data['Link']:
            link_selectors = [
                "a.event-card-link",
                "a[href*='/e/']",
                ".event-card__clamp a",
                "a"
            ]
            for selector in link_selectors:
                try:
                    link_elem = card_element.find_element(By.CSS_SELECTOR, selector)
                    href = link_elem.get_attribute('href') or ''
                    if href and 'eventbrite' in href.lower():
                        event_data['Link'] = href
                        break
                except:
                    continue
        
        # Extract Date
        date_selectors = [
            ".event-card__date",
            ".event-date",
            "[data-testid='event-date']",
            ".event-card__clamp--date",
            ".date-info"
        ]
        for selector in date_selectors:
            try:
                date_elem = card_element.find_element(By.CSS_SELECTOR, selector)
                event_data['Date'] = date_elem.text.strip()
                if event_data['Date']:
                    break
            except:
                continue
        
        # Extract Location
        location_selectors = [
            ".event-card__location",
            ".event-location",
            "[data-testid='event-location']",
            ".event-card__clamp--location",
            ".location-info"
        ]
        for selector in location_selectors:
            try:
                location_elem = card_element.find_element(By.CSS_SELECTOR, selector)
                event_data['Location'] = location_elem.text.strip()
                if event_data['Location']:
                    break
            except:
                continue
        
        # Extract Image URL
        image_selectors = [
            ".event-card__image img",
            "img.event-card-image",
            "img[data-testid='event-image']",
            ".event-card__media img",
            "img"
        ]
        for selector in image_selectors:
            try:
                img_elem = card_element.find_element(By.CSS_SELECTOR, selector)
                event_data['Image_URL'] = img_elem.get_attribute('src') or img_elem.get_attribute('data-src') or ''
                if event_data['Image_URL']:
                    break
            except:
                continue
        
        # Extract Organizer (if available)
        organizer_selectors = [
            ".event-card__organizer",
            ".organizer-name",
            "[data-testid='event-organizer']",
            ".event-organizer"
        ]
        for selector in organizer_selectors:
            try:
                organizer_elem = card_element.find_element(By.CSS_SELECTOR, selector)
                event_data['Organizer'] = organizer_elem.text.strip()
                if event_data['Organizer']:
                    break
            except:
                continue
        
        # Only return data if at least title or link was found
        if event_data['Title'] or event_data['Link']:
            return event_data
        else:
            return None
            
    except Exception as e:
        print(f"Error extracting event data: {str(e)}")
        return None


def scrape_eventbrite_events(url, max_events=20):
    """
    Scrape Eventbrite Toronto workshop events.
    
    Args:
        url: The Eventbrite Toronto search results URL
        max_events: Maximum number of events to scrape (default: 20)
    
    Returns:
        pandas.DataFrame: DataFrame containing scraped event data
    """
    driver = None
    events_data = []
    
    try:
        print("Setting up Chrome driver...")
        driver = setup_driver()
        
        print(f"Loading URL: {url}")
        driver.get(url)
        
        # Wait for page to load and event cards to appear
        print("Waiting for event cards to load...")
        wait = WebDriverWait(driver, 20)
        
        # Try multiple selectors for event cards
        event_card_selectors = [
            "div[data-testid='event-card']",
            ".event-card",
            ".search-event-card-wrapper",
            "article[data-testid='event-card']",
            ".eds-event-card",
            "div.eds-event-card-content__primary-content"
        ]
        
        event_cards = None
        for selector in event_card_selectors:
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                event_cards = driver.find_elements(By.CSS_SELECTOR, selector)
                if event_cards:
                    print(f"Found event cards using selector: {selector}")
                    break
            except:
                continue
        
        if not event_cards:
            print("Warning: No event cards found with standard selectors. Trying generic approach...")
            # Try to find any container that might hold events
            time.sleep(5)  # Give page more time to load
            event_cards = driver.find_elements(By.CSS_SELECTOR, "div[class*='event'], article[class*='event'], div[class*='card']")
        
        if not event_cards:
            raise Exception("Could not find any event cards on the page")
        
        print(f"Found {len(event_cards)} event cards. Extracting data from first {min(max_events, len(event_cards))}...")
        
        # Extract data from each event card
        for idx, card in enumerate(event_cards[:max_events], 1):
            print(f"Processing event {idx}/{min(max_events, len(event_cards))}...")
            event_data = extract_event_data(driver, card)
            if event_data:
                events_data.append(event_data)
            else:
                print(f"  Warning: Could not extract data from event card {idx}")
        
        print(f"\nSuccessfully extracted data from {len(events_data)} events")
        
    except Exception as e:
        print(f"Error during scraping: {str(e)}")
        raise
    
    finally:
        if driver:
            print("Closing browser...")
            driver.quit()
    
    # Create DataFrame
    if not events_data:
        print("No events were extracted. Creating empty DataFrame with required columns.")
        df = pd.DataFrame(columns=['Title', 'Date', 'Location', 'Link', 'Image_URL', 'Organizer', 'Manual_Mode', 'Manual_Category'])
    else:
        df = pd.DataFrame(events_data)
    
    # Add blank columns for manual entry
    df['Manual_Mode'] = ''
    df['Manual_Category'] = ''
    
    # Reorder columns
    column_order = ['Title', 'Date', 'Location', 'Link', 'Image_URL', 'Organizer', 'Manual_Mode', 'Manual_Category']
    df = df.reindex(columns=column_order)
    
    return df


def main():
    """Main function to run the scraper."""
    # USER: Replace this URL with the actual Eventbrite Toronto search results URL
    target_url = "https://www.eventbrite.com/d/canada--toronto/pottery/"  # INSERT YOUR EVENTBRITE TORONTO SEARCH URL HERE
    
    if not target_url:
        print("Error: Please set the target_url variable with your Eventbrite Toronto search results URL")
        return
    
    try:
        # Scrape events
        df = scrape_eventbrite_events(target_url, max_events=20)
        
        # Generate timestamp for filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"toronto_workshops_{timestamp}.xlsx"
        
        # Save to Excel
        print(f"\nSaving data to {filename}...")
        df.to_excel(filename, index=False, engine='openpyxl')
        
        print(f"✓ Successfully scraped {len(df)} events")
        print(f"✓ Data saved to {filename}")
        
    except Exception as e:
        print(f"\n✗ Scraping failed: {str(e)}")
        raise


if __name__ == "__main__":
    main()
