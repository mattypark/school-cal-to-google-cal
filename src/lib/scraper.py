from bs4 import BeautifulSoup
import requests
import json
from datetime import datetime
import re

def scrape_events(url):
    try:
        # Get the webpage content
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        events = []

        # Try different selectors for events
        selectors = [
            'table tr',  # Tables
            '.event',    # Event classes
            '.calendar-event',
            'div[class*="event"]',
            'article',
            '.course',   # Course specific
            '.schedule-item'  # Schedule specific
        ]

        for selector in selectors:
            elements = soup.select(selector)
            print(f"Found {len(elements)} elements with selector {selector}")

            for element in elements:
                try:
                    # Try to find title
                    title = None
                    title_elements = element.select('h1, h2, h3, h4, .title, .summary, strong')
                    if title_elements:
                        title = title_elements[0].text.strip()

                    # Try to find date
                    date = None
                    date_elements = element.select('.date, time, [datetime]')
                    if date_elements:
                        date = date_elements[0].text.strip()
                    elif element.get('data-date'):
                        date = element['data-date']

                    # Try to find time
                    time = None
                    time_elements = element.select('.time, .hours')
                    if time_elements:
                        time = time_elements[0].text.strip()

                    # Try to find location
                    location = None
                    location_elements = element.select('.location, .venue, .place')
                    if location_elements:
                        location = location_elements[0].text.strip()

                    # Try to find description
                    description = None
                    desc_elements = element.select('.description, .details, .info')
                    if desc_elements:
                        description = desc_elements[0].text.strip()

                    if title and (date or time):
                        event = {
                            'title': title,
                            'date': format_date(date) if date else datetime.now().strftime('%Y-%m-%d'),
                            'description': description,
                            'location': location
                        }

                        # Parse time if available
                        if time:
                            times = parse_time(time)
                            event.update(times)

                        events.append(event)

                except Exception as e:
                    print(f"Error processing element: {e}")

        return events

    except Exception as e:
        print(f"Error scraping URL: {e}")
        return []

def format_date(date_str):
    """Convert various date formats to YYYY-MM-DD"""
    try:
        # Remove ordinal indicators (1st, 2nd, 3rd, etc.)
        date_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)
        
        # Try different date formats
        formats = [
            '%Y-%m-%d',           # 2024-03-21
            '%m/%d/%Y',           # 03/21/2024
            '%B %d, %Y',          # March 21, 2024
            '%d %B %Y',           # 21 March 2024
            '%Y.%m.%d',           # 2024.03.21
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).strftime('%Y-%m-%d')
            except:
                continue

        return datetime.now().strftime('%Y-%m-%d')
    except:
        return datetime.now().strftime('%Y-%m-%d')

def parse_time(time_str):
    """Parse time string to extract start and end times"""
    try:
        # Look for time range (e.g., "2:30 PM - 3:45 PM")
        if '-' in time_str or 'to' in time_str:
            parts = time_str.replace('to', '-').split('-')
            return {
                'startTime': convert_to_24hr(parts[0].strip()),
                'endTime': convert_to_24hr(parts[1].strip())
            }
        else:
            # Single time
            return {
                'startTime': convert_to_24hr(time_str.strip())
            }
    except:
        return {}

def convert_to_24hr(time_str):
    """Convert 12-hour time to 24-hour format"""
    try:
        # Already in 24-hour format
        if ':' in time_str and 'AM' not in time_str.upper() and 'PM' not in time_str.upper():
            return time_str

        # Parse 12-hour format
        time = datetime.strptime(time_str, '%I:%M %p')
        return time.strftime('%H:%M')
    except:
        return '00:00' 