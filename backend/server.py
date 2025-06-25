from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import os
from datetime import datetime
import uuid
import requests
import xml.etree.ElementTree as ET
from typing import List, Dict, Any
import re
from urllib.parse import unquote
import json

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URL)
db = client.ubuntu_tales

# RSS Feed URL
RSS_FEED_URL = "https://anchor.fm/s/2d3bd0d0/podcast/rss"

def clean_html(text):
    """Remove HTML tags and decode HTML entities"""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.compile('<.*?>')
    text = re.sub(clean, '', text)
    # Decode common HTML entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    return text.strip()

def categorize_episode(title, description):
    """Categorize episodes based on title and description"""
    title_lower = title.lower()
    desc_lower = description.lower()
    
    if any(word in title_lower or word in desc_lower for word in ['animal', 'lion', 'elephant', 'zebra', 'giraffe', 'safari', 'jungle', 'forest']):
        return 'Animals'
    elif any(word in title_lower or word in desc_lower for word in ['folktale', 'traditional', 'wisdom', 'ancestor', 'village', 'elder']):
        return 'Folktales'
    elif any(word in title_lower or word in desc_lower for word in ['learn', 'school', 'education', 'math', 'science', 'lesson']):
        return 'Learning'
    elif any(word in title_lower or word in desc_lower for word in ['nature', 'tree', 'river', 'mountain', 'sun', 'moon', 'star']):
        return 'Nature'
    elif any(word in title_lower or word in desc_lower for word in ['culture', 'tradition', 'ceremony', 'festival', 'dance', 'music']):
        return 'Culture'
    elif any(word in title_lower or word in desc_lower for word in ['night', 'sleep', 'bedtime', 'dream', 'quiet', 'peaceful']):
        return 'Bedtime'
    else:
        return 'Stories'

def detect_language(title, description):
    """Detect language based on content"""
    # Simple language detection based on common words
    swahili_words = ['na', 'wa', 'ya', 'za', 'la', 'pa', 'ku', 'mu', 'ni', 'si', 'bi', 'mama', 'baba']
    
    text = (title + ' ' + description).lower()
    swahili_count = sum(1 for word in swahili_words if word in text)
    
    if swahili_count > 2:
        return 'Swahili'
    return 'English'

@app.get("/api/episodes")
async def get_episodes(category: str = None, language: str = None):
    """Get episodes from RSS feed with optional filtering"""
    try:
        # Check if we have cached episodes
        cached_episodes = list(db.episodes.find({}))
        if not cached_episodes:
            # Fetch and cache episodes
            await refresh_episodes()
            cached_episodes = list(db.episodes.find({}))
        
        episodes = []
        for episode in cached_episodes:
            # Convert MongoDB ObjectId to string
            episode['_id'] = str(episode['_id'])
            episodes.append(episode)
        
        # Apply filters
        if category and category != 'All':
            episodes = [ep for ep in episodes if ep.get('category') == category]
        
        if language and language != 'All':
            episodes = [ep for ep in episodes if ep.get('language') == language]
        
        return {"episodes": episodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching episodes: {str(e)}")

@app.post("/api/refresh-episodes")
async def refresh_episodes():
    """Refresh episodes from RSS feed"""
    try:
        response = requests.get(RSS_FEED_URL, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        
        # Clear existing episodes
        db.episodes.delete_many({})
        
        episodes = []
        for item in root.findall('.//item'):
            title_elem = item.find('title')
            description_elem = item.find('description')
            enclosure_elem = item.find('enclosure')
            duration_elem = item.find('.//{http://www.itunes.com/dtds/podcast-1.0.dtd}duration')
            image_elem = item.find('.//{http://www.itunes.com/dtds/podcast-1.0.dtd}image')
            pubdate_elem = item.find('pubDate')
            
            if title_elem is not None and enclosure_elem is not None:
                title = clean_html(title_elem.text)
                description = clean_html(description_elem.text) if description_elem is not None else ""
                audio_url = enclosure_elem.get('url')
                duration = duration_elem.text if duration_elem is not None else "00:00:00"
                image_url = image_elem.get('href') if image_elem is not None else ""
                pub_date = pubdate_elem.text if pubdate_elem is not None else ""
                
                # Categorize and detect language
                category = categorize_episode(title, description)
                language = detect_language(title, description)
                
                episode = {
                    'id': str(uuid.uuid4()),
                    'title': title,
                    'description': description,
                    'audioUrl': audio_url,
                    'duration': duration,
                    'imageUrl': image_url,
                    'category': category,
                    'language': language,
                    'pubDate': pub_date,
                    'createdAt': datetime.utcnow()
                }
                
                episodes.append(episode)
        
        # Insert episodes into database
        if episodes:
            db.episodes.insert_many(episodes)
        
        return {"message": f"Successfully refreshed {len(episodes)} episodes"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing episodes: {str(e)}")

@app.get("/api/categories")
async def get_categories():
    """Get available categories"""
    try:
        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        categories = list(db.episodes.aggregate(pipeline))
        category_list = [{"name": cat["_id"], "count": cat["count"]} for cat in categories]
        
        return {"categories": category_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching categories: {str(e)}")

@app.get("/api/languages")
async def get_languages():
    """Get available languages"""
    try:
        pipeline = [
            {"$group": {"_id": "$language", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        languages = list(db.episodes.aggregate(pipeline))
        language_list = [{"name": lang["_id"], "count": lang["count"]} for lang in languages]
        
        return {"languages": language_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching languages: {str(e)}")

@app.get("/api/featured")
async def get_featured_episodes():
    """Get featured episodes (latest 3)"""
    try:
        featured = list(db.episodes.find({}).sort("createdAt", -1).limit(3))
        for episode in featured:
            episode['_id'] = str(episode['_id'])
        return {"episodes": featured}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching featured episodes: {str(e)}")

@app.post("/api/play-history")
async def add_to_play_history(episode_data: dict):
    """Add episode to play history"""
    try:
        episode_data['playedAt'] = datetime.utcnow()
        episode_data['id'] = str(uuid.uuid4())
        
        db.play_history.insert_one(episode_data)
        return {"message": "Added to play history"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding to play history: {str(e)}")

@app.get("/api/recent")
async def get_recent_episodes():
    """Get recently played episodes"""
    try:
        recent = list(db.play_history.find({}).sort("playedAt", -1).limit(5))
        for episode in recent:
            episode['_id'] = str(episode['_id'])
        return {"episodes": recent}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching recent episodes: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "app": "Ubuntu Tales API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)