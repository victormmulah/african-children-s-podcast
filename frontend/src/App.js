import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const App = () => {
  const [episodes, setEpisodes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredEpisodes, setFeaturedEpisodes] = useState([]);
  const [recentEpisodes, setRecentEpisodes] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchEpisodes();
  }, [selectedCategory, selectedLanguage]);

  // Handle audio playback when isPlaying state changes
  useEffect(() => {
    if (audioRef.current && currentEpisode) {
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentEpisode]);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Refresh episodes from RSS feed
      await fetch(`${BACKEND_URL}/api/refresh-episodes`, { method: 'POST' });
      
      // Fetch all data
      const [episodesRes, categoriesRes, languagesRes, featuredRes, recentRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/episodes`),
        fetch(`${BACKEND_URL}/api/categories`),
        fetch(`${BACKEND_URL}/api/languages`),
        fetch(`${BACKEND_URL}/api/featured`),
        fetch(`${BACKEND_URL}/api/recent`)
      ]);

      const episodesData = await episodesRes.json();
      const categoriesData = await categoriesRes.json();
      const languagesData = await languagesRes.json();
      const featuredData = await featuredRes.json();
      const recentData = await recentRes.json();

      setEpisodes(episodesData.episodes || []);
      setCategories([{ name: 'All', count: episodesData.episodes?.length || 0 }, ...(categoriesData.categories || [])]);
      setLanguages([{ name: 'All', count: episodesData.episodes?.length || 0 }, ...(languagesData.languages || [])]);
      setFeaturedEpisodes(featuredData.episodes || []);
      setRecentEpisodes(recentData.episodes || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEpisodes = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (selectedLanguage !== 'All') params.append('language', selectedLanguage);
      
      const response = await fetch(`${BACKEND_URL}/api/episodes?${params}`);
      const data = await response.json();
      setEpisodes(data.episodes || []);
    } catch (error) {
      console.error('Error fetching episodes:', error);
    }
  };

  const playEpisode = async (episode, episodeIndex = null) => {
    if (currentEpisode?.id === episode.id && isPlaying) {
      // If same episode is playing, pause it
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    setCurrentEpisode(episode);
    if (episodeIndex !== null) {
      setCurrentEpisodeIndex(episodeIndex);
    } else {
      // Find the episode index in the current episodes list
      const index = episodes.findIndex(ep => ep.id === episode.id);
      setCurrentEpisodeIndex(index >= 0 ? index : 0);
    }
    
    // Set playing state to true, audio will auto-play due to useEffect
    setIsPlaying(true);
    
    // Add to play history
    try {
      await fetch(`${BACKEND_URL}/api/play-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(episode)
      });
    } catch (error) {
      console.error('Error adding to play history:', error);
    }
  };

  const pauseEpisode = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
        });
        setIsPlaying(true);
      }
    }
  };

  const playNext = () => {
    if (episodes.length > 0 && currentEpisodeIndex < episodes.length - 1) {
      const nextIndex = currentEpisodeIndex + 1;
      const nextEpisode = episodes[nextIndex];
      playEpisode(nextEpisode, nextIndex);
    }
  };

  const playPrevious = () => {
    if (episodes.length > 0 && currentEpisodeIndex > 0) {
      const prevIndex = currentEpisodeIndex - 1;
      const prevEpisode = episodes[prevIndex];
      playEpisode(prevEpisode, prevIndex);
    }
  };

  const fastForward = () => {
    if (audioRef.current) {
      const newTime = Math.min(audioRef.current.currentTime + 300, duration); // 5 minutes = 300 seconds
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const rewind = () => {
    if (audioRef.current) {
      const newTime = Math.max(audioRef.current.currentTime - 300, 0); // 5 minutes = 300 seconds
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const changePlaybackSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    // Auto-play next episode
    if (episodes.length > 0 && currentEpisodeIndex < episodes.length - 1) {
      setTimeout(() => {
        playNext();
      }, 1000); // 1 second delay before playing next
    }
  };

  const handleSeek = (e) => {
    const progressBar = e.currentTarget;
    const clickPosition = e.nativeEvent.offsetX;
    const progressBarWidth = progressBar.offsetWidth;
    const newTime = (clickPosition / progressBarWidth) * duration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Animals': '🦁',
      'Folktales': '📚',
      'Learning': '🎓',
      'Nature': '🌳',
      'Culture': '🎭',
      'Bedtime': '🌙',
      'Stories': '📖'
    };
    return icons[category] || '📖';
  };

  const getLanguageFlag = (language) => {
    return language === 'Swahili' ? '🇹🇿' : '🇬🇧';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-100 to-yellow-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-orange-600 text-xl font-bold">Loading African Children's Stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-100 to-yellow-100">
      {/* Header */}
      <header className="bg-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold">A</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">African Children's Stories</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600">Language:</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {languages.map(lang => (
                    <option key={lang.name} value={lang.name}>
                      {getLanguageFlag(lang.name)} {lang.name} ({lang.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <img 
            src="https://images.unsplash.com/photo-1615815102994-75653c209237"
            alt="African Children's Stories Hero"
            className="w-32 h-32 rounded-full mx-auto mb-6 object-cover border-4 border-white shadow-lg"
          />
          <h2 className="text-4xl font-bold mb-4">Welcome to African Children's Stories</h2>
          <p className="text-xl mb-6 max-w-3xl mx-auto">
            Discover the magic of African stories! Listen to traditional folktales, 
            learn about culture, and explore the wonderful world of African storytelling.
          </p>
          <div className="flex justify-center space-x-4 text-sm">
            <span className="bg-white bg-opacity-20 px-4 py-2 rounded-full">
              🎧 {episodes.length} Stories
            </span>
            <span className="bg-white bg-opacity-20 px-4 py-2 rounded-full">
              🌍 English & Swahili
            </span>
            <span className="bg-white bg-opacity-20 px-4 py-2 rounded-full">
              👨‍👩‍👧‍👦 Family Friendly
            </span>
          </div>
        </div>
      </section>

      {/* Featured Stories */}
      {featuredEpisodes.length > 0 && (
        <section className="py-8 bg-white">
          <div className="container mx-auto px-4">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="mr-2">⭐</span> Featured Stories
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredEpisodes.map(episode => (
                <div key={episode.id} className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-start space-x-4">
                    <img 
                      src={episode.imageUrl || "https://images.unsplash.com/photo-1655402428298-fe9b5fb757df"}
                      alt={episode.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-2 line-clamp-2">{episode.title}</h4>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{episode.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                          {getCategoryIcon(episode.category)} {episode.category}
                        </span>
                        <button
                          onClick={() => playEpisode(episode, episodes.indexOf(episode))}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center space-x-1"
                        >
                          <span>{currentEpisode?.id === episode.id && isPlaying ? '⏸️' : '▶️'}</span>
                          <span>Play</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category Filter */}
      <section className="py-6 bg-gray-50">
        <div className="container mx-auto px-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Browse by Category</h3>
          <div className="flex flex-wrap gap-3">
            {categories.map(category => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`px-6 py-3 rounded-full font-medium transition-colors ${
                  selectedCategory === category.name
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-orange-100'
                } shadow-md`}
              >
                {category.name !== 'All' && getCategoryIcon(category.name)} {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Episodes Grid */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            {selectedCategory !== 'All' ? `${selectedCategory} Stories` : 'All Stories'}
            {selectedLanguage !== 'All' && ` (${selectedLanguage})`}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {episodes.map(episode => (
              <div key={episode.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                <img 
                  src={episode.imageUrl || "https://images.pexels.com/photos/32662987/pexels-photo-32662987.jpeg"}
                  alt={episode.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                      {getCategoryIcon(episode.category)} {episode.category}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center">
                      {getLanguageFlag(episode.language)} {episode.language}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-800 mb-2 line-clamp-2">{episode.title}</h4>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">{episode.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      ⏱️ {episode.duration}
                    </span>
                    <button
                      onClick={() => playEpisode(episode, episodes.indexOf(episode))}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-medium transition-colors flex items-center space-x-2"
                    >
                      <span>{currentEpisode?.id === episode.id && isPlaying ? '⏸️' : '▶️'}</span>
                      <span>{currentEpisode?.id === episode.id && isPlaying ? 'Pause' : 'Play'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Audio Player */}
      {currentEpisode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t p-4 z-50">
          <div className="container mx-auto">
            <div className="flex items-center space-x-4">
              <img 
                src={currentEpisode.imageUrl || "https://images.unsplash.com/photo-1668783774934-ff7f5be064ee"}
                alt={currentEpisode.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 line-clamp-1">{currentEpisode.title}</h4>
                <p className="text-sm text-gray-600">{getCategoryIcon(currentEpisode.category)} {currentEpisode.category}</p>
                <p className="text-xs text-gray-500">
                  Episode {currentEpisodeIndex + 1} of {episodes.length}
                </p>
                
                {/* Progress Bar */}
                <div className="mt-2">
                  <div 
                    className="w-full bg-gray-200 rounded-full h-2 cursor-pointer"
                    onClick={handleSeek}
                  >
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
              
              {/* Enhanced Controls */}
              <div className="flex items-center space-x-2">
                {/* Volume Control */}
                <div className="hidden md:flex items-center space-x-2">
                  <span className="text-sm">🔊</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
                
                {/* Playback Speed */}
                <button
                  onClick={changePlaybackSpeed}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-full text-sm font-medium transition-colors"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>
                
                {/* Rewind 5 minutes */}
                <button
                  onClick={rewind}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors"
                  title="Rewind 5 minutes"
                >
                  ⏪
                </button>
                
                {/* Previous Episode */}
                <button
                  onClick={playPrevious}
                  disabled={currentEpisodeIndex <= 0}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors"
                  title="Previous Episode"
                >
                  ⏮️
                </button>
                
                {/* Play/Pause Button */}
                <button
                  onClick={togglePlayPause}
                  className="bg-orange-500 hover:bg-orange-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </button>
                
                {/* Next Episode */}
                <button
                  onClick={playNext}
                  disabled={currentEpisodeIndex >= episodes.length - 1}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors"
                  title="Next Episode"
                >
                  ⏭️
                </button>
                
                {/* Fast Forward 5 minutes */}
                <button
                  onClick={fastForward}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors"
                  title="Fast Forward 5 minutes"
                >
                  ⏩
                </button>
              </div>
            </div>
          </div>
          
          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            src={currentEpisode.audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleAudioEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            preload="metadata"
          />
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-xl font-bold mb-4">African Children's Stories Podcast</h3>
          <p className="text-gray-400 mb-4">
            Sharing African stories to inspire and educate children worldwide
          </p>
          <p className="text-sm text-gray-500">
            Stories from African Storybook Initiative • Narrated by Edutab.Africa
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;