async function extractEvents() {
    const url = document.getElementById("inputURL").value;
    
    try {
      const response = await fetch(`http://127.0.0.1:5000/scrape?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      
      if (data.error) {
        alert("Error: " + data.error);
      } else {
        console.log("Extracted Events:", data.events);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }