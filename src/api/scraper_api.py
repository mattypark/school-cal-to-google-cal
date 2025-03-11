from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from src.lib.scraper import scrape_events

app = FastAPI()

class ScrapeRequest(BaseModel):
    url: str

@app.post("/api/scrape")
async def scrape(request: ScrapeRequest):
    try:
        events = scrape_events(request.url)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 