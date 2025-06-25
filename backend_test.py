#!/usr/bin/env python3
import requests
import json
import time
import sys
from pprint import pprint

# Get the backend URL from the frontend .env file
BACKEND_URL = "https://721095e4-db21-4221-803c-82e56958005e.preview.emergentagent.com"
API_BASE_URL = f"{BACKEND_URL}/api"

def test_health_check():
    """Test the health check endpoint"""
    print("\n=== Testing Health Check ===")
    response = requests.get(f"{API_BASE_URL}/health")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    return True

def test_refresh_episodes():
    """Test refreshing episodes from RSS feed"""
    print("\n=== Testing RSS Feed Integration (/api/refresh-episodes) ===")
    response = requests.post(f"{API_BASE_URL}/refresh-episodes")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200
    assert "Successfully refreshed" in response.json()["message"]
    
    # Extract the number of episodes refreshed
    message = response.json()["message"]
    num_episodes = int(message.split("refreshed ")[1].split(" ")[0])
    print(f"Number of episodes refreshed: {num_episodes}")
    assert num_episodes > 0, "No episodes were refreshed"
    
    return num_episodes

def test_get_episodes(expected_count=None):
    """Test retrieving all episodes"""
    print("\n=== Testing Episode Retrieval (/api/episodes) ===")
    response = requests.get(f"{API_BASE_URL}/episodes")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    
    episodes = response.json()["episodes"]
    print(f"Total episodes retrieved: {len(episodes)}")
    
    if expected_count:
        assert len(episodes) == expected_count, f"Expected {expected_count} episodes, got {len(episodes)}"
    
    # Verify episode structure
    if episodes:
        sample_episode = episodes[0]
        print("\nSample Episode Structure:")
        pprint(sample_episode)
        
        # Check required fields
        required_fields = ['id', 'title', 'description', 'audioUrl', 'duration', 
                          'imageUrl', 'category', 'language', 'pubDate']
        
        for field in required_fields:
            assert field in sample_episode, f"Missing required field: {field}"
        
        # Verify audio URL is accessible
        audio_url = sample_episode['audioUrl']
        print(f"\nVerifying audio URL: {audio_url}")
        audio_response = requests.head(audio_url)
        print(f"Audio URL Status Code: {audio_response.status_code}")
        assert audio_response.status_code in [200, 302, 307], f"Audio URL is not accessible: {audio_url}"
    
    return episodes

def test_get_categories():
    """Test retrieving categories"""
    print("\n=== Testing Category Retrieval (/api/categories) ===")
    response = requests.get(f"{API_BASE_URL}/categories")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    
    categories = response.json()["categories"]
    print(f"Categories retrieved: {len(categories)}")
    print("Categories:")
    for category in categories:
        print(f"- {category['name']}: {category['count']} episodes")
    
    # Check for expected categories
    expected_categories = ['Animals', 'Folktales', 'Learning', 'Nature', 'Culture', 'Bedtime', 'Stories']
    category_names = [cat['name'] for cat in categories]
    
    for expected in expected_categories:
        if expected not in category_names:
            print(f"Warning: Expected category '{expected}' not found in results")
    
    return categories

def test_get_languages():
    """Test retrieving languages"""
    print("\n=== Testing Language Retrieval (/api/languages) ===")
    response = requests.get(f"{API_BASE_URL}/languages")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    
    languages = response.json()["languages"]
    print(f"Languages retrieved: {len(languages)}")
    print("Languages:")
    for language in languages:
        print(f"- {language['name']}: {language['count']} episodes")
    
    # Check for expected languages
    expected_languages = ['English', 'Swahili']
    language_names = [lang['name'] for lang in languages]
    
    for expected in expected_languages:
        if expected not in language_names:
            print(f"Warning: Expected language '{expected}' not found in results")
    
    return languages

def test_get_featured():
    """Test retrieving featured episodes"""
    print("\n=== Testing Featured Episodes (/api/featured) ===")
    response = requests.get(f"{API_BASE_URL}/featured")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200
    
    featured = response.json()["episodes"]
    print(f"Featured episodes retrieved: {len(featured)}")
    
    # Should return 3 episodes
    assert len(featured) <= 3, f"Expected at most 3 featured episodes, got {len(featured)}"
    
    # Print featured episodes
    for i, episode in enumerate(featured):
        print(f"\nFeatured Episode {i+1}:")
        print(f"- Title: {episode['title']}")
        print(f"- Category: {episode['category']}")
        print(f"- Language: {episode['language']}")
    
    return featured

def test_filtered_episodes():
    """Test episode filtering by category and language"""
    print("\n=== Testing Episode Filtering (/api/episodes?category=X&language=Y) ===")
    
    # First get categories and languages to use for filtering
    categories = test_get_categories()
    languages = test_get_languages()
    
    if not categories or not languages:
        print("Cannot test filtering: no categories or languages available")
        return False
    
    # Test filtering by category
    category_to_test = categories[0]['name']
    print(f"\nTesting category filter: {category_to_test}")
    response = requests.get(f"{API_BASE_URL}/episodes?category={category_to_test}")
    assert response.status_code == 200
    
    category_episodes = response.json()["episodes"]
    print(f"Episodes in category '{category_to_test}': {len(category_episodes)}")
    
    # Verify all episodes have the correct category
    for episode in category_episodes:
        assert episode['category'] == category_to_test, f"Episode has wrong category: {episode['category']}"
    
    # Test filtering by language
    language_to_test = languages[0]['name']
    print(f"\nTesting language filter: {language_to_test}")
    response = requests.get(f"{API_BASE_URL}/episodes?language={language_to_test}")
    assert response.status_code == 200
    
    language_episodes = response.json()["episodes"]
    print(f"Episodes in language '{language_to_test}': {len(language_episodes)}")
    
    # Verify all episodes have the correct language
    for episode in language_episodes:
        assert episode['language'] == language_to_test, f"Episode has wrong language: {episode['language']}"
    
    # Test combined filtering
    print(f"\nTesting combined filter: category={category_to_test}, language={language_to_test}")
    response = requests.get(f"{API_BASE_URL}/episodes?category={category_to_test}&language={language_to_test}")
    assert response.status_code == 200
    
    combined_episodes = response.json()["episodes"]
    print(f"Episodes with category '{category_to_test}' and language '{language_to_test}': {len(combined_episodes)}")
    
    # Verify all episodes have the correct category and language
    for episode in combined_episodes:
        assert episode['category'] == category_to_test, f"Episode has wrong category: {episode['category']}"
        assert episode['language'] == language_to_test, f"Episode has wrong language: {episode['language']}"
    
    return True

def run_all_tests():
    """Run all tests and return results"""
    results = {}
    
    try:
        print("\n========== UBUNTU TALES BACKEND API TESTS ==========\n")
        
        # Test health check
        results["health_check"] = test_health_check()
        
        # Test RSS feed integration
        num_episodes = test_refresh_episodes()
        results["refresh_episodes"] = num_episodes > 0
        
        # Test episode retrieval
        episodes = test_get_episodes(expected_count=num_episodes)
        results["get_episodes"] = len(episodes) > 0
        
        # Test categories
        categories = test_get_categories()
        results["get_categories"] = len(categories) > 0
        
        # Test languages
        languages = test_get_languages()
        results["get_languages"] = len(languages) > 0
        
        # Test featured episodes
        featured = test_get_featured()
        results["get_featured"] = len(featured) > 0
        
        # Test filtering
        results["filtered_episodes"] = test_filtered_episodes()
        
        # Print summary
        print("\n========== TEST RESULTS SUMMARY ==========")
        all_passed = True
        for test, passed in results.items():
            status = "✅ PASSED" if passed else "❌ FAILED"
            print(f"{test}: {status}")
            if not passed:
                all_passed = False
        
        if all_passed:
            print("\n🎉 ALL TESTS PASSED! The backend API is working correctly.")
        else:
            print("\n⚠️ SOME TESTS FAILED. Please check the logs for details.")
        
        return all_passed
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    run_all_tests()