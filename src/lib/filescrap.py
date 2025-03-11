from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

def scrape_website(url):
    """Scrapes the given URL and extracts meaningful text."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            return {"error": f"Failed to fetch page (status {response.status_code})"}

        soup = BeautifulSoup(response.text, "html.parser")

        # Try extracting event-like content dynamically
        events = []

        # Look for common elements like tables, lists, or structured divs
        for tag in soup.find_all(["h2", "h3", "p", "li", "div"]):
            text = tag.get_text(strip=True)
            if len(text) > 5:  # Ignore empty or short strings
                events.append(text)

        if not events:
            return {"error": "No event-like content found."}

        return {"events": events}

    except Exception as e:
        return {"error": str(e)}

@app.route("/scrape", methods=["GET"])
def scrape():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    
    result = scrape_website(url)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)