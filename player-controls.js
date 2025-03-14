/**
 * Media Player Controls
 * This script handles all the functionality for the media player including:
 * - Audio-only mode with album artwork
 * - 360° video mode with A-Frame
 * - Synchronized playback between modes
 * - Video playback controls (play/pause, rewind, fast forward)
 * - Scrubber functionality with progress indication
 * - Volume controls
 * - Camera reset for 360° view
 * - Touch support for mobile devices
 * - Mobile device motion permission handling
 * - Preloading of media assets
 * - Scene and playlist information display
 * - Keyboard shortcuts (spacebar for play/pause, arrow keys for navigation)
 * - Responsive design for mobile devices
 * - Playlist navigation with auto-advance to next track
 * - Track loading from playlist.json with fallback to default playlist
 */

console.log('Player controls script loaded');

// Initialize the player
function initializePlayer() {
  console.log('Initializing player...');
  
  // Initialize playlist container positioning
  if (playlistContainer) {
    // Ensure the playlist container is properly positioned from the start
    // This prevents the initial offscreen rendering when first opened
    playlistContainer.style.visibility = 'hidden';
    playlistContainer.style.transform = 'translate(-50%, -50%) scale(0.95)';
    playlistContainer.style.top = '50%';
    playlistContainer.style.left = '50%';
    
    // Force a reflow to ensure proper positioning
    void playlistContainer.offsetHeight;
  }
  
  // Load playlist data from JSON
  loadPlaylistData();
  
  // Set the active media element to audio by default
  activeMediaElement = audio;
  
  // Hide loading message after a delay
  setTimeout(() => {
    message.style.display = "none";
  }, 2000);
  
  // Check if we're on a mobile device
  checkIfMobile();
  
  // Check device orientation if on mobile
  if (isMobileDevice) {
    checkOrientation();
    
    // Add orientation change listener for mobile devices
    window.addEventListener('orientationchange', checkOrientation);
    
    // Check for device motion permission on iOS
    if (isIOS) {
      checkDeviceMotionPermission();
    }
  } else {
    // Show keyboard shortcuts info for desktop users after a short delay
    setTimeout(showKeyboardShortcutsInfo, 3000);
  }
  
  // Set up periodic muting check to prevent double audio playback
  const mutingCheckInterval = setInterval(() => {
    // Only check when media is playing
    if (!audio.paused || !video.paused) {
      enforceProperMuting();
    }
  }, 1000); // Check every second
  
  // Set up Chapter 1 sync after a short delay
  setTimeout(setupChapter1Sync, 1000);
  
  // Ensure the playlist is populated (as a fallback)
  setTimeout(() => {
    if (!playlist || playlist.length === 0) {
      console.log('Playlist still empty after timeout, using default playlist');
      initializeDefaultPlaylist();
    } else if (playlist.length > 0 && (!playlistTracks.children.length || playlistTracks.children.length === 1 && playlistTracks.children[0].textContent.includes('Loading'))) {
      console.log('Playlist not populated yet, forcing population');
      populatePlaylist();
    }
  }, 3000);
  
  // Log that initialization is complete
  console.log('Player initialization complete');
}

document.addEventListener('DOMContentLoaded', function () {
  // Get DOM elements
  const video = document.getElementById('video360');
  const audio = document.getElementById('audioElement');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const rewindBtn = document.getElementById('rewindBtn');
  const forwardBtn = document.getElementById('forwardBtn');
  const muteBtn = document.getElementById('muteBtn');
  const resetCameraBtn = document.getElementById('resetCameraBtn');
  const viewXRBtn = document.getElementById('viewXRBtn');
  const exitXRBtn = document.getElementById('exitXRBtn');
  const message = document.getElementById('message');
  const scrubber = document.getElementById('scrubber');
  const scrubberProgress = document.getElementById('scrubberProgress');
  const currentTimeDisplay = document.getElementById('currentTime');
  const durationDisplay = document.getElementById('duration');
  const cameraEntity = document.getElementById('cameraEntity');
  const permissionOverlay = document.getElementById('permissionOverlay');
  const enableMotionBtn = document.getElementById('enableMotion');
  const videosphere = document.getElementById('videosphere');
  const sceneNameElement = document.getElementById('sceneName');
  const playlistNameElement = document.getElementById('playlistName');
  const playerControls = document.querySelector('.player-controls');
  const aScene = document.querySelector('a-scene');
  const audioPlayerContainer = document.getElementById('audioPlayerContainer');
  const videoPlayerContainer = document.getElementById('videoPlayerContainer');
  const audioTitle = document.getElementById('audioTitle');
  const audioArtist = document.getElementById('audioArtist');
  const albumArtwork = document.querySelector('.album-artwork');
  const albumArtImg = document.getElementById('albumArt');
  const playlistToggle = document.getElementById('playlistToggle');
  const playlistContainer = document.getElementById('playlistContainer');
  const playlistOverlay = document.getElementById('playlistOverlay');
  const playlistClose = document.getElementById('playlistClose');
  const playlistTracks = document.getElementById('playlistTracks');
  
  let isScrubbing = false;
  let isVideoPreloaded = false;
  let isAudioPreloaded = false;
  let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  let isFirstPlay = true; // Track if this is the first time the user presses play
  let isInputFocused = false; // Track if an input element is focused
  let aFramePermissionHandled = false; // Track if A-Frame has handled the permission
  let isSeeking = false; // Track if the video is currently seeking
  let seekingTimeout = null; // Timeout for seeking state
  let isXRMode = false; // Track if we're in XR (360°) mode or audio-only mode
  let activeMediaElement = audio; // Default to audio element as the active media
  let currentTrackIndex = 0; // Track the current track index in the playlist

  // Apply mobile-specific class if on a mobile device
  if (isMobileDevice) {
    document.body.classList.add('mobile-device');
    
    // Check for orientation changes
    window.addEventListener('orientationchange', function() {
      // Add a small delay to ensure the orientation change is complete
      setTimeout(function() {
        if (window.orientation === 90 || window.orientation === -90) {
          // Landscape orientation
          document.body.classList.add('landscape');
          document.body.classList.remove('portrait');
        } else {
          // Portrait orientation
          document.body.classList.add('portrait');
          document.body.classList.remove('landscape');
        }
      }, 100);
    });
    
    // Initial orientation check
    if (window.orientation === 90 || window.orientation === -90 || 
        (window.innerWidth > window.innerHeight)) {
      document.body.classList.add('landscape');
    } else {
      document.body.classList.add('portrait');
    }
  }

  // ===== MODE SWITCHING FUNCTIONS =====
  
  /**
   * Update the audio player UI with track information
   */
  function updateAudioPlayerUI(title, artist, artworkUrl) {
    audioTitle.textContent = title || 'Unknown Track';
    audioArtist.textContent = artist || 'Unknown Artist';
    
    if (artworkUrl) {
      albumArtImg.src = artworkUrl;
    }
  }
  
  /**
   * Set up synchronization between audio and video elements for Chapter 1
   * This ensures perfect sync when toggling between audio-only and 360° modes
   */
  function setupChapter1Sync() {
    console.log('Setting up media synchronization');
    
    // Keep both media elements loaded and ready
    // Note: We're not setting sources here anymore as they're set in loadTrack
    // This function now just sets up the event listeners for synchronization
    
    // Set up event listeners for synchronization
    
    // 1. Sync on seeking (when user scrubs)
    audio.addEventListener('seeking', syncVideoToAudio);
    video.addEventListener('seeking', syncAudioToVideo);
    
    // 2. Periodic sync during playback (every 2 seconds)
    let syncInterval = null;
    
    function startSyncInterval() {
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(() => {
        if (!isSeeking) {
          if (isXRMode) {
            syncAudioToVideo();
          } else {
            syncVideoToAudio();
          }
        }
      }, 2000);
    }
    
    function stopSyncInterval() {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    }
    
    // 3. Sync on play/pause
    audio.addEventListener('play', () => {
      if (isXRMode) {
        // If we're in XR mode but audio starts playing, immediately mute it
        // This prevents both sources from playing simultaneously
        console.log("Audio play event while in XR mode - muting audio");
        audio.muted = true;
        return;
      }
      
      // Keep video in sync but ensure it's muted
      video.currentTime = audio.currentTime;
      
      // Always ensure video is muted when in audio mode
      video.muted = true;
      
      // Play video silently to keep it in sync, but only if audio is the active element
      if (activeMediaElement === audio) {
        console.log("Playing silent video for sync");
        const videoPlayPromise = video.play();
        if (videoPlayPromise !== undefined) {
          videoPlayPromise.catch(error => {
            console.error('Error playing silent video for sync:', error);
          });
        }
      }
      
      startSyncInterval();
    });
    
    video.addEventListener('play', () => {
      if (!isXRMode) {
        // If we're in audio mode but video starts playing, immediately mute it
        // This prevents both sources from playing simultaneously
        console.log("Video play event while in audio mode - muting video");
        video.muted = true;
        return;
      }
      
      // Keep audio in sync but ensure it's muted
      audio.currentTime = video.currentTime;
      
      // Always ensure audio is muted when in XR mode
      audio.muted = true;
      
      // Play audio silently to keep it in sync, but only if video is the active element
      if (activeMediaElement === video) {
        console.log("Playing silent audio for sync");
        const audioPlayPromise = audio.play();
        if (audioPlayPromise !== undefined) {
          audioPlayPromise.catch(error => {
            console.error('Error playing silent audio for sync:', error);
          });
        }
      }
      
      startSyncInterval();
    });
    
    audio.addEventListener('pause', () => {
      if (isXRMode) return;
      
      // Pause video when audio pauses
      console.log("Pausing video because audio paused");
      video.pause();
      stopSyncInterval();
    });
    
    video.addEventListener('pause', () => {
      if (!isXRMode) return;
      
      // Pause audio when video pauses
      console.log("Pausing audio because video paused");
      audio.pause();
      stopSyncInterval();
    });
    
    // 4. Sync on ended
    audio.addEventListener('ended', () => {
      if (!isXRMode) {
        video.currentTime = 0;
        video.pause();
        
        // Check if this is the last track
        if (currentTrackIndex >= playlist.length - 1) {
          // This is the last track, show end of tour message
          message.textContent = "End of audio tour reached";
          message.style.display = "block";
          setTimeout(() => message.style.display = "none", 3000);
        } else {
          // Auto-advance to next track when current track ends
          loadNextTrack();
        }
      }
    });
    
    video.addEventListener('ended', () => {
      if (isXRMode) {
        audio.currentTime = 0;
        audio.pause();
        
        // Check if this is the last track
        if (currentTrackIndex >= playlist.length - 1) {
          // This is the last track, show end of tour message
          message.textContent = "End of audio tour reached";
          message.style.display = "block";
          setTimeout(() => message.style.display = "none", 3000);
        } else {
          // Auto-advance to next track when current track ends
          loadNextTrack();
        }
      }
    });
    
    // Add volume change listeners to ensure proper muting
    audio.addEventListener('volumechange', () => {
      if (isXRMode && !audio.muted) {
        console.log("Enforcing audio mute in XR mode");
        audio.muted = true;
      }
    });
    
    video.addEventListener('volumechange', () => {
      if (!isXRMode && !video.muted) {
        console.log("Enforcing video mute in audio mode");
        video.muted = true;
      }
    });
    
    // Add additional listeners for timeupdate to catch any muting issues during playback
    audio.addEventListener('timeupdate', () => {
      // Check every few seconds during playback
      if (Math.floor(audio.currentTime) % 5 === 0) {
        if (isXRMode && !audio.muted) {
          console.log("Caught unmuted audio during timeupdate in XR mode");
          audio.muted = true;
        }
      }
    });
    
    video.addEventListener('timeupdate', () => {
      // Check every few seconds during playback
      if (Math.floor(video.currentTime) % 5 === 0) {
        if (!isXRMode && !video.muted) {
          console.log("Caught unmuted video during timeupdate in audio mode");
          video.muted = true;
        }
      }
    });
    
    // Make the "View in XR" button visible for Chapter 1
    if (viewXRBtn) {
      viewXRBtn.style.display = 'flex';
    }
    
    console.log('Chapter 1 synchronization setup complete');
  }
  
  /**
   * Sync video time to match audio time
   */
  function syncVideoToAudio() {
    if (Math.abs(video.currentTime - audio.currentTime) > 0.3) {
      console.log(`Syncing video (${video.currentTime.toFixed(2)}) to audio (${audio.currentTime.toFixed(2)})`);
      video.currentTime = audio.currentTime;
    }
  }
  
  /**
   * Sync audio time to match video time
   */
  function syncAudioToVideo() {
    if (Math.abs(audio.currentTime - video.currentTime) > 0.3) {
      console.log(`Syncing audio (${audio.currentTime.toFixed(2)}) to video (${video.currentTime.toFixed(2)})`);
      audio.currentTime = video.currentTime;
    }
  }
  
  /**
   * Update the mute button to reflect the current state
   */
  function updateMuteButton() {
    if (activeMediaElement.muted) {
      muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
      muteBtn.classList.add('muted');
    } else {
      muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
      muteBtn.classList.remove('muted');
    }
  }
  
  /**
   * Enforce proper muting based on current mode
   * This ensures we never have both audio sources playing simultaneously
   */
  function enforceProperMuting() {
    if (isXRMode) {
      // In XR mode, video should be unmuted and audio should be muted
      if (audio.muted === false) {
        console.log("Enforcing audio mute in XR mode");
        audio.muted = true;
      }
      // Only update video mute state if it's the active element
      if (activeMediaElement === video && video.muted === true) {
        console.log("Unmuting video in XR mode");
        video.muted = false;
      }
    } else {
      // In audio mode, audio should be unmuted and video should be muted
      if (video.muted === false) {
        console.log("Enforcing video mute in audio mode");
        video.muted = true;
      }
      // Only update audio mute state if it's the active element
      if (activeMediaElement === audio && audio.muted === true) {
        console.log("Unmuting audio in audio mode");
        audio.muted = false;
      }
    }
    
    // Update the mute button to reflect the current state
    updateMuteButton();
  }
  
  /**
   * Enhanced switch to XR mode with perfect synchronization for Chapter 1
   */
  function switchToXRMode() {
    // Save current time and play state
    const currentTime = audio.currentTime;
    const wasPlaying = !audio.paused;
    const wasMuted = audio.muted; // Save the current mute state
    
    // Show loading message
    message.textContent = "Loading 360° experience...";
    message.style.display = "block";
    
    // Pause both media elements to prevent any unexpected playback
    audio.pause();
    video.pause();
    
    // Hide audio player, show video player
    audioPlayerContainer.classList.add('hidden');
    videoPlayerContainer.classList.remove('hidden');
    
    // Update camera reset button visibility
    resetCameraBtn.parentElement.classList.add('visible');
    
    // Set video time to match audio time for perfect sync
    video.currentTime = currentTime;
    
    // Update active media element
    activeMediaElement = video;
    isXRMode = true;
    
    // Apply the same mute state to the video
    video.muted = wasMuted;
    
    // Always ensure audio is muted in XR mode to prevent double sound
    audio.muted = true;
    
    // Update the mute button to reflect the current state
    updateMuteButton();
    
    // Sync play state
    if (wasPlaying) {
      // Only play video if audio was playing before the switch
      console.log("Audio was playing, starting video playback");
      video.play().then(() => {
        message.style.display = "none";
        updatePlayPauseButton();
        // Double-check muting after playback starts
        enforceProperMuting();
      }).catch(error => {
        console.error('Error playing video:', error);
        message.textContent = "Error loading 360° experience. Try again.";
      });
    } else {
      // Both should remain paused
      console.log("Audio was paused, keeping video paused");
      message.style.display = "none";
      updatePlayPauseButton();
    }
    
    // Update UI to reflect current mode
    updateUIForCurrentMode();
  }
  
  /**
   * Enhanced switch to audio mode with perfect synchronization for Chapter 1
   */
  function switchToAudioMode() {
    // Save current time and play state
    const currentTime = video.currentTime;
    const wasPlaying = !video.paused;
    const wasMuted = video.muted; // Save the current mute state
    
    // Pause both media elements to prevent any unexpected playback
    video.pause();
    audio.pause();
    
    // Hide video player, show audio player
    videoPlayerContainer.classList.add('hidden');
    audioPlayerContainer.classList.remove('hidden');
    
    // Hide camera reset button in audio mode
    resetCameraBtn.parentElement.classList.remove('visible');
    
    // Set audio time to match video time for perfect sync
    audio.currentTime = currentTime;
    
    // Update active media element
    activeMediaElement = audio;
    isXRMode = false;
    
    // Apply the same mute state to the audio
    audio.muted = wasMuted;
    
    // Always ensure video is muted in audio mode to prevent double sound
    video.muted = true;
    
    // Update the mute button to reflect the current state
    updateMuteButton();
    
    // Sync play state
    if (wasPlaying) {
      // Only play audio if video was playing before the switch
      console.log("Video was playing, starting audio playback");
      audio.play().then(() => {
        updatePlayPauseButton();
        // Double-check muting after playback starts
        enforceProperMuting();
      }).catch(error => {
        console.error('Error playing audio:', error);
        message.textContent = "Error playing audio. Try again.";
        message.style.display = "block";
        setTimeout(() => message.style.display = "none", 3000);
      });
    } else {
      // Both should remain paused
      console.log("Video was paused, keeping audio paused");
      updatePlayPauseButton();
    }
    
    // Update UI to reflect current mode
    updateUIForCurrentMode();
  }
  
  /**
   * Update UI elements based on current mode (XR or audio-only)
   */
  function updateUIForCurrentMode() {
    // Update player controls position
    ensurePlayerControlsCentered();
    
    // Update play/pause button state
    updatePlayPauseButton();
    
    // Note: We're no longer calling updateMuteButton here since we handle it
    // directly in the switchToXRMode and switchToAudioMode functions
    // to preserve the mute state when switching modes
    
    // Don't update scene and playlist info here as it would override the track information
    // that was set in loadTrack
    // updateVideoInfo(sceneNameElement.textContent, playlistNameElement.textContent);
  }

  // ===== SCENE AND PLAYLIST INFORMATION =====
  
  // Set scene and playlist information
  // This could be dynamically loaded from a database or configuration file
  function updateVideoInfo(sceneName, playlistName) {
    if (sceneNameElement && sceneName) {
      sceneNameElement.textContent = sceneName;
    }
    
    if (playlistNameElement && playlistName) {
      playlistNameElement.textContent = playlistName;
    }
    
    // Also update audio player info
    if (audioTitle && sceneName) {
      audioTitle.textContent = sceneName;
    }
    
    if (audioArtist && playlistName) {
      audioArtist.textContent = playlistName;
    }
  }
  
  // Example: Update with media information
  // In a real application, this would be pulled from metadata or a database
  // updateVideoInfo("Japantown", "San Francisco 360°");
  
  // You could also extract this from the filename or path
  function extractSceneInfoFromPath() {
    const mediaPath = activeMediaElement.querySelector('source').src;
    const filename = mediaPath.split('/').pop();
    
    // Example: Extract scene name from filename (e.g., "2025-03-08-JAPANTOWN-XR1-LOW.mp4")
    if (filename) {
      const parts = filename.split('-');
      if (parts.length >= 4) {
        // Extract the scene name (e.g., "JAPANTOWN")
        const sceneName = parts[3].charAt(0) + parts[3].slice(1).toLowerCase();
        // Don't update with hardcoded values - this function is just an example
        console.log(`Extracted scene name from filename: ${sceneName}`);
        // updateVideoInfo(sceneName, "San Francisco 360°");
      }
    }
  }
  
  // Uncomment to use automatic extraction from filename
  // extractSceneInfoFromPath();

  // ===== PRELOADING AND INITIALIZATION =====
  
  // Start preloading media immediately
  preloadMedia();
  
  // Hide camera reset button in audio mode (default)
  resetCameraBtn.style.display = 'none';
  
  // Check if we need to request device motion permission (for mobile)
  // Listen for A-Frame's permission handling first
  if (isMobileDevice && aScene) {
    // Listen for A-Frame's devicemotion permission events
    aScene.addEventListener('devicemotion-permissions-granted', function() {
      console.log('A-Frame handled device motion permissions');
      aFramePermissionHandled = true;
      permissionOverlay.style.display = 'none'; // Hide our overlay if it's showing
    });
    
    aScene.addEventListener('devicemotion-permissions-denied', function() {
      console.log('A-Frame device motion permissions denied');
      aFramePermissionHandled = true;
      permissionOverlay.style.display = 'none'; // Hide our overlay if it's showing
    });
  }
  
  /**
   * Preload both audio and video to ensure they're ready when needed
   * Enhanced for Chapter 1 to preload both versions
   */
  function preloadMedia() {
    message.textContent = "Preloading media...";
    message.style.display = "block";
    
    // For Chapter 1, we want to preload both the audio-only and 360° versions
    const audioUrl = "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/japantown+audio+only+test.mp3";
    const videoUrl = "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-08-JAPANTOWN-XR1-LOW.mp4";
    
    // Set up counters to track when both files are loaded
    let audioLoaded = false;
    let videoLoaded = false;
    
    // Function to check if both files are loaded
    const checkBothLoaded = () => {
      if (audioLoaded && videoLoaded) {
        isAudioPreloaded = true;
        isVideoPreloaded = true;
        message.textContent = "Media ready. Click play to start.";
        setTimeout(() => {
          if (message.textContent === "Media ready. Click play to start.") {
            message.style.display = "none";
          }
        }, 3000);
        console.log("Both audio and video preloaded successfully");
      }
    };
    
    // Preload audio-only version
    const tempAudio = new Audio();
    tempAudio.preload = 'auto';
    tempAudio.src = audioUrl;
    
    tempAudio.addEventListener('canplaythrough', function onAudioReady() {
      audioLoaded = true;
      tempAudio.removeEventListener('canplaythrough', onAudioReady);
      checkBothLoaded();
    });
    
    tempAudio.addEventListener('error', function(e) {
      console.error('Audio preload error:', e);
      message.textContent = "Error preloading audio. Try again later.";
    });
    
    // Preload 360° video version
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'auto';
    tempVideo.muted = true;
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.src = videoUrl;
    
    tempVideo.addEventListener('canplaythrough', function onVideoReady() {
      videoLoaded = true;
      tempVideo.removeEventListener('canplaythrough', onVideoReady);
      checkBothLoaded();
    });
    
    tempVideo.addEventListener('error', function(e) {
      console.error('Video preload error:', e);
      message.textContent = "Error preloading 360° video. Audio-only mode available.";
    });
    
    // Start loading both files
    tempAudio.load();
    tempVideo.load();
  }
  
  /**
   * Check if all media is preloaded and update UI accordingly
   */
  function checkAllMediaPreloaded() {
    if (isAudioPreloaded) {
      message.textContent = "Media ready. Click play to start.";
      setTimeout(() => {
        if (message.textContent === "Media ready. Click play to start.") {
          message.style.display = "none";
        }
      }, 3000);
    }
  }
  
  /**
   * Check and request device motion permission on mobile devices
   * Only called when switching to XR mode if A-Frame hasn't already handled it
   */
  function checkDeviceMotionPermission() {
    // Skip if A-Frame already handled permissions
    if (aFramePermissionHandled) {
      return;
    }
    
    // Check if DeviceMotionEvent is available and requires permission
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      
      // Show the permission overlay
      permissionOverlay.style.display = 'flex';
      
      // Add click handler for the enable button
      enableMotionBtn.addEventListener('click', function() {
        DeviceMotionEvent.requestPermission()
          .then(response => {
            if (response === 'granted') {
              // Permission granted, hide overlay
              permissionOverlay.style.display = 'none';
              aFramePermissionHandled = true; // Mark as handled
              message.textContent = "Motion controls enabled. Use your phone to look around.";
              setTimeout(() => message.style.display = "none", 3000);
            } else {
              // Permission denied
              permissionOverlay.style.display = 'none';
              aFramePermissionHandled = true; // Mark as handled
              message.textContent = "Motion controls denied. Use touch to look around.";
              setTimeout(() => message.style.display = "none", 3000);
            }
          })
          .catch(error => {
            console.error('Error requesting device motion permission:', error);
            permissionOverlay.style.display = 'none';
            message.textContent = "Error enabling motion controls.";
            setTimeout(() => message.style.display = "none", 3000);
          });
      });
    } else {
      // Device motion doesn't require permission or isn't available
      console.log('Device motion permission not required or not available');
    }
  }

  // ===== MEDIA EVENT HANDLERS =====
  
  // Error handling for both audio and video
  video.addEventListener('error', (e) => {
    console.error('Video Error:', e);
    message.textContent = "Error loading video";
    message.style.display = "block";
  });
  
  audio.addEventListener('error', (e) => {
    console.error('Audio Error:', e);
    message.textContent = "Error loading audio";
    message.style.display = "block";
  });

  // Metadata loaded handlers
  video.addEventListener('loadedmetadata', () => {
    console.log('Video metadata loaded');
    updateMediaDuration();
  });
  
  audio.addEventListener('loadedmetadata', () => {
    console.log('Audio metadata loaded');
    updateMediaDuration();
  });
  
  function updateMediaDuration() {
    // Use the active media element's duration
    const duration = Math.floor(activeMediaElement.duration);
    
    // Set max value of scrubber to media duration in seconds
    scrubber.max = duration;
    
    // Format and display duration
    durationDisplay.textContent = formatTime(duration);
    
    // Initialize progress bar to 0
    updateProgressBar(0);
  }

  // Media data loaded handlers
  video.addEventListener('loadeddata', () => {
    console.log('Video data loaded');
    
    // Ensure the videosphere is visible and ready
    videosphere.setAttribute('visible', 'true');
    
    if (isXRMode) {
      if (isMobileDevice) {
        message.textContent = "360° Video Loaded. Use your phone to look around.";
      } else {
        message.textContent = "360° Video Loaded. Use your mouse to look around.";
      }
      
      setTimeout(() => message.style.display = "none", 3000);
    }
  });
  
  audio.addEventListener('loadeddata', () => {
    console.log('Audio data loaded');
    
    if (!isXRMode) {
      message.textContent = "Audio Loaded. Ready to play.";
      setTimeout(() => message.style.display = "none", 3000);
    }
  });
  
  // Update time display and scrubber position during playback
  function updateTimeDisplay() {
    if (!isScrubbing) {
      const currentTime = Math.floor(activeMediaElement.currentTime);
      const duration = Math.floor(activeMediaElement.duration) || 1;
      const progressPercentage = (currentTime / duration) * 100;
      
      scrubber.value = currentTime;
      currentTimeDisplay.textContent = formatTime(currentTime);
      
      // Update progress bar width
      updateProgressBar(progressPercentage);
      
      // Check if we're near the end of the track (within last 1 second)
      // This is a fallback in case the 'ended' event doesn't fire properly
      if (duration > 0 && (duration - currentTime) <= 1 && !activeMediaElement.paused) {
        console.log(`Near end of track detected: ${currentTime}/${duration}`);
        
        // Only trigger once when we reach this point
        if (!activeMediaElement.nearEndTriggered) {
          activeMediaElement.nearEndTriggered = true;
          console.log("Track nearly complete, preparing to advance");
          
          // If not the last track, prepare to load the next one
          if (currentTrackIndex < playlist.length - 1) {
            console.log("Advancing to next track due to near-end detection");
            
            // Force pause to prevent double-triggering with the ended event
            activeMediaElement.pause();
            
            // Use a timeout to ensure we don't interfere with any 'ended' event
            setTimeout(() => {
              // Double-check we're still near the end (in case user scrubbed back)
              if ((duration - activeMediaElement.currentTime) <= 1.5) {
                console.log("Still near end, loading next track");
                
                try {
                  const nextIndex = currentTrackIndex + 1;
                  if (playlist && playlist[nextIndex]) {
                    console.log(`Loading track ${nextIndex}: ${playlist[nextIndex].title}`);
                    loadTrack(playlist[nextIndex]);
                    
                    // Auto-play the next track
                    setTimeout(() => {
                      if (activeMediaElement.paused) {
                        console.log('Auto-playing next track');
                        togglePlayPause();
                      }
                    }, 500);
                  }
                } catch (error) {
                  console.error("Error in near-end advancement:", error);
                }
              }
            }, 200);
          }
        }
      } else {
        // Reset the flag when not near the end
        activeMediaElement.nearEndTriggered = false;
      }
    }
  }
  
  video.addEventListener('timeupdate', () => {
    if (isXRMode) updateTimeDisplay();
  });
  
  audio.addEventListener('timeupdate', () => {
    if (!isXRMode) updateTimeDisplay();
  });
  
  // Seeking event handlers
  function handleSeeking() {
    console.log('Media seeking started');
    isSeeking = true;
    
    // Clear any existing timeout
    if (seekingTimeout) {
      clearTimeout(seekingTimeout);
    }
    
    // Show loading message
    message.textContent = "Loading media...";
    message.style.display = "block";
    
    // Set a timeout to handle cases where seeked event might not fire
    seekingTimeout = setTimeout(() => {
      if (isSeeking) {
        console.log('Seeking timeout - forcing seeked state');
        isSeeking = false;
        message.style.display = "none";
      }
    }, 5000); // 5 second timeout
  }
  
  function handleSeeked() {
    console.log('Media seeking ended');
    isSeeking = false;
    
    // Clear the timeout
    if (seekingTimeout) {
      clearTimeout(seekingTimeout);
      seekingTimeout = null;
    }
    
    // Hide loading message
    message.style.display = "none";
  }
  
  video.addEventListener('seeking', handleSeeking);
  video.addEventListener('seeked', handleSeeked);
  audio.addEventListener('seeking', handleSeeking);
  audio.addEventListener('seeked', handleSeeked);
  
  // Handle waiting state (buffering)
  function handleWaiting() {
    console.log('Media buffering');
    message.textContent = "Buffering...";
    message.style.display = "block";
  }
  
  function handlePlaying() {
    // Only hide the message if it's showing a buffering message
    if (message.textContent === "Buffering..." || 
        message.textContent === "Loading media...") {
      message.style.display = "none";
    }
  }
  
  video.addEventListener('waiting', handleWaiting);
  video.addEventListener('playing', handlePlaying);
  audio.addEventListener('waiting', handleWaiting);
  audio.addEventListener('playing', handlePlaying);

  // ===== BUTTON CLICK HANDLERS =====
  
  // View in XR button handler
  viewXRBtn.addEventListener('click', function() {
    // Request device motion permission if needed
    if (isMobileDevice && !aFramePermissionHandled) {
      checkDeviceMotionPermission();
    }
    
    // Switch to XR mode
    switchToXRMode();
  });
  
  // Exit XR button handler
  exitXRBtn.addEventListener('click', function() {
    // Switch to audio-only mode
    switchToAudioMode();
  });
  
  // Close button handler - removed since there's no close button in audio-only mode
  // The close button was removed from the HTML
  
  // Set initial button states
  updateMuteButton();
  
  /**
   * Update the play/pause button to reflect the current state
   */
  function updatePlayPauseButton() {
    if (activeMediaElement.paused) {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
  }

  /**
   * Toggle play/pause state of the active media element
   */
  function togglePlayPause() {
    if (activeMediaElement.paused) {
      // Show loading message if media isn't preloaded yet
      if (!(isXRMode ? isVideoPreloaded : isAudioPreloaded)) {
        message.textContent = "Loading media...";
        message.style.display = "block";
      }
      
      // If this is the first time playing, set up proper mute states
      if (isFirstPlay) {
        if (isXRMode) {
          // In XR mode, unmute video but keep audio muted
          video.muted = false;
          audio.muted = true;
        } else {
          // In audio mode, unmute audio but keep video muted
          audio.muted = false;
          video.muted = true;
        }
        updateMuteButton();
        isFirstPlay = false;
      } else {
        // Ensure proper muting based on current mode
        enforceProperMuting();
      }
      
      // Play the active media element
      console.log(`Playing ${isXRMode ? 'video' : 'audio'} element`);
      activeMediaElement.play()
        .then(() => {
          updatePlayPauseButton();
          if (message.textContent === "Loading media...") {
            message.style.display = "none";
          }
          // Double-check muting after playback starts
          enforceProperMuting();
        })
        .catch(error => {
          console.error('Error playing media:', error);
          message.textContent = "Error playing media. Please try again.";
          message.style.display = "block";
        });
    } else {
      // Pause both media elements to ensure sync
      console.log(`Pausing ${isXRMode ? 'video' : 'audio'} element`);
      activeMediaElement.pause();
      
      // Also pause the inactive element to ensure it doesn't continue playing
      if (isXRMode) {
        if (!audio.paused) {
          console.log("Also pausing audio element");
          audio.pause();
        }
      } else {
        if (!video.paused) {
          console.log("Also pausing video element");
          video.pause();
        }
      }
      
      updatePlayPauseButton();
    }
  }

  // Play/Pause button handler
  playPauseBtn.addEventListener('click', togglePlayPause);

  // Rewind button handler
  rewindBtn.addEventListener('click', function () {
    // If we're within the first 3 seconds of the track, go to previous track
    if (activeMediaElement.currentTime <= 3) {
      loadPreviousTrack();
    } else {
      // Otherwise just rewind 10 seconds
      activeMediaElement.currentTime = Math.max(0, activeMediaElement.currentTime - 10);
    }
  });
  
  // Fast forward button handler
  forwardBtn.addEventListener('click', function () {
    // If we're within the last 3 seconds of the track, go to next track
    if (activeMediaElement.duration - activeMediaElement.currentTime <= 3) {
      loadNextTrack();
    } else {
      // Otherwise just forward 10 seconds
      activeMediaElement.currentTime = Math.min(activeMediaElement.duration, activeMediaElement.currentTime + 10);
    }
  });

  // Mute button handler
  muteBtn.addEventListener('click', function() {
    // Toggle the mute state of the active media element
    const newMuteState = !activeMediaElement.muted;
    
    // Apply the mute state to the active media element
    activeMediaElement.muted = newMuteState;
    
    // Ensure the inactive element is always muted
    if (isXRMode) {
      // In XR mode, video is active and audio should always be muted
      audio.muted = true;
    } else {
      // In audio mode, audio is active and video should always be muted
      video.muted = true;
    }
    
    // Update the mute button UI
    updateMuteButton();
  });
  
  // Reset camera orientation
  resetCameraBtn.addEventListener('click', function() {
    // Only visible in XR mode
    if (isXRMode && cameraEntity && cameraEntity.components && cameraEntity.components['look-controls']) {
      // Reset the camera rotation
      cameraEntity.setAttribute('rotation', '0 0 0');
      
      // Reset the look-controls component's state
      const lookControls = cameraEntity.components['look-controls'];
      if (lookControls) {
        lookControls.pitchObject.rotation.x = 0;
        lookControls.yawObject.rotation.y = 0;
      }
      
      // Show a brief message
      message.textContent = "Camera view reset";
      message.style.display = "block";
      setTimeout(() => message.style.display = "none", 1500);
    }
  });
  
  // ===== KEYBOARD CONTROLS =====
  
  // Track when an input element is focused to prevent spacebar triggering play/pause
  document.addEventListener('focusin', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      isInputFocused = true;
    }
  });
  
  document.addEventListener('focusout', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      isInputFocused = false;
    }
  });
  
  // Add keyboard event listener for spacebar to toggle play/pause
  if (!isMobileDevice) {
    document.addEventListener('keydown', function(e) {
      // Check if no input element is focused
      if (!isInputFocused) {
        // Spacebar for play/pause
        if (e.code === 'Space') {
          e.preventDefault(); // Prevent page scrolling
          togglePlayPause();
        }
        
        // Left arrow for previous track or rewind
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift + Left Arrow for previous track
            loadPreviousTrack();
          } else {
            // Left Arrow for rewind
            activeMediaElement.currentTime = Math.max(0, activeMediaElement.currentTime - 10);
          }
        }
        
        // Right arrow for next track or fast forward
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift + Right Arrow for next track
            loadNextTrack();
          } else {
            // Right Arrow for fast forward
            activeMediaElement.currentTime = Math.min(activeMediaElement.duration, activeMediaElement.currentTime + 10);
          }
        }
        
        // Up/Down arrows for volume (if not muted)
        if (e.code === 'ArrowUp' && !activeMediaElement.muted) {
          e.preventDefault();
          activeMediaElement.volume = Math.min(1, activeMediaElement.volume + 0.1);
        }
        
        if (e.code === 'ArrowDown' && !activeMediaElement.muted) {
          e.preventDefault();
          activeMediaElement.volume = Math.max(0, activeMediaElement.volume - 0.1);
        }
        
        // M key for mute toggle
        if (e.code === 'KeyM') {
          e.preventDefault();
          // Toggle mute state
          const newMuteState = !activeMediaElement.muted;
          activeMediaElement.muted = newMuteState;
          
          // Ensure the inactive element is always muted
          if (isXRMode) {
            audio.muted = true;
          } else {
            video.muted = true;
          }
          
          updateMuteButton();
        }
        
        // P key for playlist toggle
        if (e.code === 'KeyP') {
          e.preventDefault();
          togglePlaylist();
        }
      }
    });
  }
  
  // ===== SCRUBBER FUNCTIONALITY =====
  
  // Mouse events for scrubber
  scrubber.addEventListener('mousedown', () => {
    isScrubbing = true;
  });
  
  scrubber.addEventListener('mouseup', () => {
    isScrubbing = false;
    activeMediaElement.currentTime = scrubber.value;
    const percentage = (scrubber.value / scrubber.max) * 100;
    updateProgressBar(percentage);
  });
  
  scrubber.addEventListener('input', () => {
    currentTimeDisplay.textContent = formatTime(scrubber.value);
    const percentage = (scrubber.value / scrubber.max) * 100;
    updateProgressBar(percentage);
  });
  
  // Touch support for mobile
  scrubber.addEventListener('touchstart', () => {
    isScrubbing = true;
  });
  
  scrubber.addEventListener('touchend', () => {
    isScrubbing = false;
    activeMediaElement.currentTime = scrubber.value;
    const percentage = (scrubber.value / scrubber.max) * 100;
    updateProgressBar(percentage);
  });
  
  // ===== HELPER FUNCTIONS =====
  
  /**
   * Updates the progress bar width based on the current playback position
   * @param {number} percentage - The percentage of the media that has been played
   */
  function updateProgressBar(percentage) {
    scrubberProgress.style.width = `${percentage}%`;
  }
  
  /**
   * Formats seconds into MM:SS format
   * @param {number} seconds - The time in seconds to format
   * @return {string} The formatted time string
   */
  function formatTime(seconds) {
    seconds = Math.floor(seconds);
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Check if the media is currently seeking or buffering
   * @return {boolean} True if the media is loading, false otherwise
   */
  function isMediaLoading() {
    return isSeeking || activeMediaElement.readyState < 3; // readyState < 3 means not enough data
  }
  
  /**
   * Ensures the player controls are properly centered in the viewport
   * This helps prevent edge cases where controls might be pinned to the right
   */
  function ensurePlayerControlsCentered() {
    if (playerControls) {
      // Force recalculation of the transform to ensure centering
      playerControls.style.left = '50%';
      playerControls.style.transform = 'translateX(-50%)';
      playerControls.style.right = 'auto';
      
      // Reset any margins that might affect centering
      playerControls.style.margin = '0';
      
      // Set explicit width based on device type
      if (isMobileDevice) {
        if (window.innerWidth > window.innerHeight) {
          // Landscape
          playerControls.style.width = `calc(100% - 40px)`;
        } else {
          // Portrait
          playerControls.style.width = `calc(100% - 20px)`;
        }
      } else {
        // Desktop - use max-width instead of fixed width
        playerControls.style.width = '100%';
        playerControls.style.maxWidth = '400px';
      }
      
      // For some browsers, we need to trigger a reflow
      void playerControls.offsetWidth;
      
      // Sync album artwork width with player controls
      syncAlbumArtworkWidth();
    }
  }
  
  /**
   * Synchronizes the album artwork width with the player controls width
   * This ensures visual consistency between the two elements
   */
  function syncAlbumArtworkWidth() {
    if (albumArtwork && playerControls) {
      // Get the computed width of the player controls
      const controlsWidth = playerControls.offsetWidth;
      
      // Apply the same width to the album artwork
      if (!isMobileDevice) {
        // On desktop, match the exact width and max-width
        albumArtwork.style.width = `${controlsWidth}px`;
        albumArtwork.style.maxWidth = playerControls.style.maxWidth;
      } else {
        // On mobile, we use the CSS rules defined in the stylesheet
        // which already match the player controls width
        if (window.innerWidth > window.innerHeight) {
          // Landscape
          albumArtwork.style.width = `calc(100% - 40px)`;
        } else {
          // Portrait
          albumArtwork.style.width = `calc(100% - 20px)`;
        }
      }
      
      // Log the widths for debugging
      console.log(`Synced widths - Controls: ${controlsWidth}px, Artwork: ${albumArtwork.offsetWidth}px`);
    }
  }
  
  // Call once on initialization to ensure proper centering
  ensurePlayerControlsCentered();
  
  // Handle orientation changes explicitly for mobile
  window.addEventListener('orientationchange', function() {
    // Add a small delay to ensure the orientation change is complete
    setTimeout(function() {
      ensurePlayerControlsCentered();
      syncAlbumArtworkWidth();
    }, 100);
  });
  
  // Call the centering function periodically to handle any edge cases
  setInterval(ensurePlayerControlsCentered, 2000);
  
  // Handle window resize events to adjust UI for different screen sizes
  window.addEventListener('resize', function() {
    if (isMobileDevice) {
      if (window.innerWidth > window.innerHeight) {
        document.body.classList.add('landscape');
        document.body.classList.remove('portrait');
      } else {
        document.body.classList.add('portrait');
        document.body.classList.remove('landscape');
      }
    }
    
    // Ensure player controls remain centered after resize
    ensurePlayerControlsCentered();
    
    // Sync album artwork width with player controls
    syncAlbumArtworkWidth();
  });

  // Handle album artwork loading
  if (albumArtImg) {
    // Show loading state
    albumArtImg.style.opacity = '0.7';
    
    // Handle successful load
    albumArtImg.addEventListener('load', function() {
      albumArtImg.style.opacity = '1';
      console.log('Album artwork loaded successfully');
    });
    
    // Handle loading error
    albumArtImg.addEventListener('error', function(e) {
      console.error('Error loading album artwork:', e);
      // Fall back to a solid color background if image fails to load
      albumArtwork.style.backgroundColor = '#333';
      // Add a music icon as fallback
      albumArtwork.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%; font-size: 80px; color: rgba(255,255,255,0.5);">
          <i class="fas fa-music"></i>
        </div>
        ${albumArtwork.innerHTML}
      `;
    });
  }

  // ===== PLAYLIST FUNCTIONALITY =====

  // Initialize playlist data
  let playlist = [];
  let currentPlaylistTitle = "";
  let currentPlaylistSubtitle = "";

  /**
   * Load playlist data from JSON file
   */
  function loadPlaylistData() {
    console.log('Attempting to load playlist data from playlist.json');
    
    // Immediately update UI with loading state
    updateVideoInfo("Loading playlist...", "Please wait");
    updateAudioPlayerUI("Loading playlist...", "Please wait", null);
    
    // Add a loading indicator to the playlist if it's open
    if (playlistTracks) {
      playlistTracks.innerHTML = '<li class="playlist-track"><div class="track-info"><div class="track-title">Loading tracks...</div></div></li>';
    }
    
    fetch('playlist.json')
      .then(response => {
        console.log('Fetch response status:', response.status);
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Playlist data loaded successfully:', data);
        
        // Verify that the data has the expected structure
        if (!data || !data.tracks || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          throw new Error('Invalid playlist data format or empty playlist');
        }
        
        // Map the tracks from the JSON to our internal format
        playlist = data.tracks.map(track => ({
          id: track.chapter,
          title: track.title,
          duration: formatDuration(track),
          active: currentTrackIndex !== -1 && track.id === playlist[currentTrackIndex]?.id, // Mark the current track as active
          audioSrc: track.audio_url,
          videoSrc: track.XR_Scene,
          artworkUrl: track.artwork_url,
          playlistName: track.playlist,
          isAR: track.IsAR
        }));
        
        console.log(`Processed ${playlist.length} tracks from playlist.json`);
        
        // Set playlist title and subtitle if available
        if (playlist.length > 0) {
          currentPlaylistTitle = "Chinatown Audio Tour";
          currentPlaylistSubtitle = playlist[0].playlistName || "Look Up";
          
          // Update playlist header
          const playlistTitle = document.querySelector('.playlist-title');
          const playlistSubtitle = document.querySelector('.playlist-subtitle');
          
          if (playlistTitle) {
            playlistTitle.textContent = currentPlaylistTitle;
            console.log('Updated playlist title to:', currentPlaylistTitle);
          }
          
          if (playlistSubtitle) {
            playlistSubtitle.textContent = currentPlaylistSubtitle;
            console.log('Updated playlist subtitle to:', currentPlaylistSubtitle);
          }
        }
        
        // Populate the playlist UI
        populatePlaylist();
        
        // Load the first track by default
        if (playlist.length > 0) {
          console.log('Loading first track from playlist:', playlist[0].title);
          
          // Ensure the first track is marked as active
          playlist[0].active = true;
          currentTrackIndex = 0;
          
          // Force update UI with the first track's information immediately
          const firstTrack = playlist[0];
          console.log('First track data:', firstTrack);
          
          // Update UI elements directly
          if (sceneNameElement) {
            sceneNameElement.textContent = firstTrack.title;
            console.log('Updated scene name to:', firstTrack.title);
          }
          
          if (playlistNameElement) {
            playlistNameElement.textContent = firstTrack.playlistName || "Look Up";
            console.log('Updated playlist name to:', firstTrack.playlistName || "Look Up");
          }
          
          if (audioTitle) {
            audioTitle.textContent = firstTrack.title;
            console.log('Updated audio title to:', firstTrack.title);
          }
          
          if (audioArtist) {
            audioArtist.textContent = firstTrack.playlistName || "Look Up";
            console.log('Updated audio artist to:', firstTrack.playlistName || "Look Up");
          }
          
          if (albumArtImg && firstTrack.artworkUrl) {
            albumArtImg.src = firstTrack.artworkUrl;
            console.log('Updated album artwork to:', firstTrack.artworkUrl);
          }
          
          // Now load the track properly
          loadTrack(firstTrack);
        }
        
        // Verify playlist was populated correctly
        verifyPlaylistPopulated();
      })
      .catch(error => {
        console.error('Error loading playlist data:', error);
        message.textContent = "Error loading playlist. Using default tracks.";
        message.style.display = "block";
        setTimeout(() => message.style.display = "none", 3000);
        
        // Fallback to hardcoded playlist if JSON fails to load
        initializeDefaultPlaylist();
      });
  }
  
  /**
   * Verify that the playlist was populated correctly
   */
  function verifyPlaylistPopulated() {
    console.log('Verifying playlist population...');
    
    // Check if playlist container exists and has children
    const playlistContainer = document.querySelector('.playlist-tracks');
    if (!playlistContainer) {
      console.error('Playlist container not found');
      return;
    }
    
    const trackElements = playlistContainer.querySelectorAll('.playlist-track');
    console.log(`Found ${trackElements.length} track elements in the playlist container`);
    
    // Check if UI elements are updated
    console.log('Current UI state:');
    if (sceneNameElement) console.log('Scene name:', sceneNameElement.textContent);
    if (playlistNameElement) console.log('Playlist name:', playlistNameElement.textContent);
    if (audioTitle) console.log('Audio title:', audioTitle.textContent);
    if (audioArtist) console.log('Audio artist:', audioArtist.textContent);
    if (albumArtImg) console.log('Album art src:', albumArtImg.src);
    
    // Check audio and video sources
    if (audio) console.log('Audio source:', audio.src);
    if (video) console.log('Video source:', video.src);
  }

  /**
   * Estimate duration from audio file (fallback function)
   */
  function formatDuration(track) {
    // Use chapter number to create consistent durations instead of random ones
    // This ensures the same track always shows the same duration
    const chapterSeed = track.chapter || 1;
    
    // Base duration on chapter number (between 2 and 5 minutes)
    const minutes = 2 + (chapterSeed % 4);
    
    // Use chapter number to determine seconds (0-59)
    const seconds = (chapterSeed * 17) % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Initialize default playlist as fallback
   */
  function initializeDefaultPlaylist() {
    console.log('Using default playlist data');
    playlist = [
      { id: 1, title: "Chapter 1: Chinatown Memories", duration: "3:45", active: true, audioSrc: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/japantown+audio+only+test.mp3", videoSrc: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-08-JAPANTOWN-XR1-LOW.mp4", artworkUrl: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-12-CHINATOWN-AUDIOTOUR/2025-03-12-CHINATOWN-ARTWORK/001+Ch1-TelecomAR-ezgif.com-optimize.gif", playlistName: "Look Up", isAR: true },
      { id: 2, title: "Chapter 2: Look Tin Eli", duration: "4:20", active: false, audioSrc: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-12-CHINATOWN-AUDIOTOUR/Chapter+2+Look+Tin+Eli.wav", videoSrc: "", artworkUrl: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-12-CHINATOWN-AUDIOTOUR/2025-03-12-CHINATOWN-ARTWORK/002+Look_Tin_Eli_12017_Page_17.jpg", playlistName: "Look Up", isAR: false },
      { id: 3, title: "Chapter 3: Earthquake", duration: "3:10", active: false, audioSrc: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-12-CHINATOWN-AUDIOTOUR/Chapter+3+Earthquake.wav", videoSrc: "", artworkUrl: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-12-CHINATOWN-AUDIOTOUR/2025-03-12-CHINATOWN-ARTWORK/003+Chinatown+front_+1906+earthquake.jpg", playlistName: "Look Up", isAR: false },
      { id: 4, title: "Chapter 4: Spofford Alley", duration: "5:30", active: false, audioSrc: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-12-CHINATOWN-AUDIOTOUR/Chapter+4+Spofford+Alley.wav", videoSrc: "", artworkUrl: "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-12-CHINATOWN-AUDIOTOUR/2025-03-12-CHINATOWN-ARTWORK/004+Spofford+-+1908_.jpg", playlistName: "Look Up", isAR: false }
    ];
    
    // Set default playlist title and subtitle
    currentPlaylistTitle = "Chinatown Audio Tour";
    currentPlaylistSubtitle = "Look Up";
    
    // Update playlist header
    const playlistTitle = document.querySelector('.playlist-title');
    const playlistSubtitle = document.querySelector('.playlist-subtitle');
    
    if (playlistTitle) {
      playlistTitle.textContent = currentPlaylistTitle;
      console.log('Updated playlist title to:', currentPlaylistTitle);
    }
    
    if (playlistSubtitle) {
      playlistSubtitle.textContent = currentPlaylistSubtitle;
      console.log('Updated playlist subtitle to:', currentPlaylistSubtitle);
    }
    
    // Populate the playlist UI
    populatePlaylist();
    
    // Set the current track index
    currentTrackIndex = 0;
    
    // Load the first track by default
    if (playlist.length > 0) {
      console.log('Loading first track from default playlist:', playlist[0].title);
      
      // Load the first track
      loadTrack(playlist[0]);
      
      // Update UI with the first track's information
      updateVideoInfo(playlist[0].title, playlist[0].playlistName || "Look Up");
      updateAudioPlayerUI(playlist[0].title, playlist[0].playlistName || "Look Up", playlist[0].artworkUrl);
    }
  }

  /**
   * Populate the playlist with tracks
   */
  function populatePlaylist() {
    console.log('Populating playlist with tracks:', playlist);
    
    // Clear existing tracks
    playlistTracks.innerHTML = '';
    
    if (!playlist || playlist.length === 0) {
      console.error('No playlist data available to populate');
      // Add a message to the playlist if it's empty
      playlistTracks.innerHTML = '<li class="playlist-track"><div class="track-info"><div class="track-title">No tracks available</div></div></li>';
      return;
    }
    
    // Add each track to the playlist
    playlist.forEach(track => {
      console.log(`Adding track to UI: ${track.id} - ${track.title}`);
      
      const trackElement = document.createElement('li');
      trackElement.className = `playlist-track${track.active ? ' active' : ''}`;
      trackElement.dataset.id = track.id;
      
      trackElement.innerHTML = `
        <div class="track-number">${track.id}</div>
        <div class="track-info">
          <div class="track-title">${track.title}</div>
          <div class="track-duration">${track.duration}</div>
        </div>
      `;
      
      // Add click handler to load this track
      trackElement.addEventListener('click', () => {
        console.log(`Track clicked: ${track.id} - ${track.title}`);
        
        // Check if we were playing before selecting the new track
        const wasPlaying = !activeMediaElement.paused;
        console.log(`Track selected while playback was ${wasPlaying ? 'active' : 'paused'}`);
        
        // If currently playing, pause to prevent audio overlap during loading
        if (wasPlaying) {
          activeMediaElement.pause();
        }
        
        // Load the track - the loadTrack function will handle auto-play if needed
        loadTrack(track);
        
        // Close playlist after selection
        togglePlaylist();
      });
      
      playlistTracks.appendChild(trackElement);
    });
    
    console.log(`Populated playlist UI with ${playlist.length} tracks`);
    
    // Force a reflow to ensure the playlist is rendered correctly
    void playlistTracks.offsetHeight;
  }

  /**
   * Load a track from the playlist
   * @param {Object} track - The track to load
   */
  function loadTrack(track) {
    // Debug log to help diagnose issues
    console.log('loadTrack called with:', JSON.stringify({
      id: track.id,
      title: track.title,
      playlistName: track.playlistName,
      audioSrc: track.audioSrc,
      videoSrc: track.videoSrc,
      isAR: track.isAR
    }, null, 2));
    
    // Store the play state before loading the new track
    const wasPlaying = !activeMediaElement.paused;
    console.log(`loadTrack: Previous playback state was ${wasPlaying ? 'playing' : 'paused'}`);
    
    // Update active state in playlist data
    playlist.forEach(t => t.active = t.id === track.id);
    
    // Update current track index
    currentTrackIndex = playlist.findIndex(t => t.id === track.id);
    console.log(`Loading track ${track.id}, index ${currentTrackIndex}: "${track.title}"`);
    
    // Update UI to show active track
    const trackElements = playlistTracks.querySelectorAll('.playlist-track');
    trackElements.forEach(el => {
      if (parseInt(el.dataset.id) === track.id) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
    
    // Show loading message
    message.textContent = `Loading "${track.title}"...`;
    message.style.display = "block";
    
    // Pause both media elements to prevent any unexpected playback
    audio.pause();
    video.pause();
    
    // Check if this track has an XR scene
    const hasXRScene = track.videoSrc && track.videoSrc.trim() !== '';
    
    // Update audio source
    if (track.audioSrc) {
      audio.src = track.audioSrc;
      audio.load();
    }
    
    // Update video source if available
    if (hasXRScene) {
      const videoSource = video.querySelector('source');
      if (videoSource) {
        videoSource.src = track.videoSrc;
      }
      video.load();
      
      // Make the "View in XR" button visible for tracks with XR scenes
      if (viewXRBtn) {
        viewXRBtn.style.display = track.isAR ? 'flex' : 'none';
      }
      
      // Set up synchronization for tracks with XR scenes
      setupChapter1Sync();
    } else {
      // Hide the "View in XR" button for tracks without XR scenes
      if (viewXRBtn) {
        viewXRBtn.style.display = 'none';
      }
      
      // If we're in XR mode but the new track doesn't have an XR scene, switch to audio mode
      if (isXRMode) {
        switchToAudioMode();
      }
    }
    
    // Reset playback position
    audio.currentTime = 0;
    video.currentTime = 0;
    
    // Ensure proper muting based on current mode
    enforceProperMuting();
    
    // Update scene and playlist info - make sure to use the track's title and playlist name
    console.log(`Updating UI with track info: "${track.title}" | "${track.playlistName || 'Look Up'}"`);
    updateVideoInfo(track.title, track.playlistName || "Look Up");
    
    // Update audio player UI with track information
    updateAudioPlayerUI(track.title, track.playlistName || "Look Up", track.artworkUrl);
    
    // Always update the play/pause button to reflect the current state
    // This ensures the UI is consistent even if playback hasn't started yet
    if (wasPlaying) {
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    
    // Function to play media when it's ready
    const playWhenReady = () => {
      // Double-check mute states before playing
      enforceProperMuting();
      
      console.log('Media ready to play, starting playback');
      activeMediaElement.play()
        .then(() => {
          message.style.display = "none";
          updatePlayPauseButton();
          // Double-check muting after playback starts
          enforceProperMuting();
        })
        .catch(error => {
          console.error('Error playing media:', error);
          message.textContent = "Error playing media. Please try again.";
          message.style.display = "block";
          // Reset play button if playback fails
          playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        });
      
      // Remove event listeners
      video.removeEventListener('canplay', playWhenReady);
      audio.removeEventListener('canplay', playWhenReady);
    };
    
    // Set up event listeners for media readiness
    if (wasPlaying) {
      // If we were playing before, auto-play the new track when ready
      console.log('Setting up auto-play for new track');
      video.addEventListener('canplay', playWhenReady);
      audio.addEventListener('canplay', playWhenReady);
      
      // Also set a timeout as a fallback in case the canplay event doesn't fire
      setTimeout(() => {
        if (activeMediaElement.paused && wasPlaying) {
          console.log('Fallback: Starting playback after timeout');
          togglePlayPause();
        }
      }, 1500);
    } else {
      // Just hide the message after a delay if not playing
      setTimeout(() => {
        message.style.display = "none";
      }, 2000);
    }
  }

  /**
   * Toggle the playlist visibility
   */
  function togglePlaylist() {
    const isOpen = playlistContainer.classList.contains('open');
    
    if (isOpen) {
      // Close playlist
      console.log('Closing playlist');
      playlistContainer.classList.remove('open');
      playlistOverlay.classList.remove('open');
      document.body.classList.remove('playlist-open');
    } else {
      // Open playlist
      console.log('Opening playlist');
      
      // Verify that the playlist has tracks before opening
      if (!playlist || playlist.length === 0 || playlistTracks.children.length === 0) {
        console.log('Playlist is empty, attempting to reload playlist data');
        // If the playlist is empty, try to reload it
        loadPlaylistData();
      } else {
        console.log(`Playlist has ${playlist.length} tracks and ${playlistTracks.children.length} UI elements`);
      }
      
      // Ensure the playlist container is properly positioned before showing
      // This prevents the initial offscreen rendering
      playlistContainer.style.visibility = 'hidden';
      
      // Force a reflow to ensure proper positioning
      void playlistContainer.offsetHeight;
      
      // Now make it visible and open
      playlistContainer.style.visibility = 'visible';
      playlistContainer.classList.add('open');
      playlistOverlay.classList.add('open');
      document.body.classList.add('playlist-open');
      
      // Scroll to the active track if there is one
      setTimeout(() => {
        const activeTrack = playlistTracks.querySelector('.playlist-track.active');
        if (activeTrack) {
          console.log('Scrolling to active track');
          activeTrack.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300); // Wait for the animation to complete
    }
  }

  /**
   * Force reload of the playlist data and UI
   */
  function forceReloadPlaylist() {
    console.log('Forcing playlist reload');
    
    // Show loading indicator in the playlist
    if (playlistTracks) {
      playlistTracks.innerHTML = '<li class="playlist-track"><div class="track-info"><div class="track-title loading">Loading tracks...</div></div></li>';
    }
    
    // Fetch the playlist data again
    fetch('playlist.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Playlist data reloaded successfully:', data);
        
        if (!data || !data.tracks || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          throw new Error('Invalid playlist data format or empty playlist');
        }
        
        // Map the tracks from the JSON to our internal format
        playlist = data.tracks.map(track => ({
          id: track.chapter,
          title: track.title,
          duration: formatDuration(track),
          active: currentTrackIndex !== -1 && track.id === playlist[currentTrackIndex]?.id, // Mark the current track as active
          audioSrc: track.audio_url,
          videoSrc: track.XR_Scene,
          artworkUrl: track.artwork_url,
          playlistName: track.playlist,
          isAR: track.IsAR
        }));
        
        // Populate the playlist UI
        populatePlaylist();
        
        // Scroll to the active track
        setTimeout(() => {
          const activeTrack = playlistTracks.querySelector('.playlist-track.active');
          if (activeTrack) {
            activeTrack.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      })
      .catch(error => {
        console.error('Error reloading playlist data:', error);
        
        // Show error message in the playlist
        if (playlistTracks) {
          playlistTracks.innerHTML = '<li class="playlist-track"><div class="track-info"><div class="track-title">Error loading tracks</div></div></li>';
        }
        
        // Fallback to default playlist
        initializeDefaultPlaylist();
      });
  }

  // Playlist toggle button handler
  playlistToggle.addEventListener('click', function() {
    // First toggle the playlist visibility
    togglePlaylist();
    
    // If the playlist is now open and empty, force a reload
    if (playlistContainer.classList.contains('open') && 
        (!playlist || playlist.length === 0 || playlistTracks.children.length === 0 || 
         playlistTracks.children.length === 1 && playlistTracks.children[0].textContent.includes('Loading'))) {
      forceReloadPlaylist();
    }
  });

  // Playlist close button handler
  playlistClose.addEventListener('click', togglePlaylist);

  // Playlist overlay click handler (close when clicking outside)
  playlistOverlay.addEventListener('click', togglePlaylist);

  // Initialize the player
  initializePlayer();

  /**
   * Show information about keyboard shortcuts to desktop users
   */
  function showKeyboardShortcutsInfo() {
    message.textContent = "Keyboard shortcuts: Space (play/pause), ←→ (seek), Shift+←→ (prev/next track), ↑↓ (volume), M (mute), P (playlist)";
    message.style.display = "block";
    
    // Hide after 5 seconds
    setTimeout(() => {
      message.style.display = "none";
    }, 5000);
  }

  /**
   * Check if the device is a mobile device
   */
  function checkIfMobile() {
    // This is already handled by the isMobileDevice variable initialization
    // This function is just a placeholder for any additional mobile-specific setup
    console.log('Checking if mobile device:', isMobileDevice);
    
    // Check for iOS specifically
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      document.body.classList.add('ios-device');
      console.log('iOS device detected');
    }
  }

  /**
   * Check the current orientation of the device
   */
  function checkOrientation() {
    if (window.orientation === 90 || window.orientation === -90 || 
        (window.innerWidth > window.innerHeight)) {
      document.body.classList.add('landscape');
      document.body.classList.remove('portrait');
      console.log('Landscape orientation detected');
    } else {
      document.body.classList.add('portrait');
      document.body.classList.remove('landscape');
      console.log('Portrait orientation detected');
    }
  }

  /**
   * Load the next track in the playlist
   * Ensures sequential playback without skipping tracks
   */
  function loadNextTrack() {
    console.log(`loadNextTrack called - current track index: ${currentTrackIndex}, playlist length: ${playlist ? playlist.length : 0}`);
    
    if (!playlist || playlist.length === 0) {
      console.error('Cannot load next track: playlist is empty');
      return;
    }
    
    // Check if we're at the last track
    if (currentTrackIndex >= playlist.length - 1) {
      console.log('Reached the end of the playlist, not advancing');
      // We're at the last track, don't wrap around
      message.textContent = "End of audio tour reached";
      message.style.display = "block";
      setTimeout(() => message.style.display = "none", 2000);
      return;
    }
    
    // Always move to the next sequential track
    const nextIndex = currentTrackIndex + 1;
    console.log(`Advancing to next track: ${nextIndex} (${playlist[nextIndex]?.title || 'unknown'})`);
    
    // Verify the next track exists before loading
    if (!playlist[nextIndex]) {
      console.error(`Error: Track at index ${nextIndex} does not exist in playlist`);
      return;
    }
    
    // Store the track we're going to load
    const nextTrack = playlist[nextIndex];
    console.log(`Next track: ${nextTrack.id} - ${nextTrack.title}`);
    
    // Load the next track
    try {
      loadTrack(nextTrack);
      
      // Show a brief message
      message.textContent = `Playing: ${nextTrack.title}`;
      message.style.display = "block";
      setTimeout(() => message.style.display = "none", 2000);
      
      // Force play the next track after a short delay
      setTimeout(() => {
        if (activeMediaElement.paused) {
          console.log('Auto-playing next track');
          togglePlayPause();
        }
      }, 500);
    } catch (error) {
      console.error('Error loading next track:', error);
      message.textContent = "Error loading next track";
      message.style.display = "block";
    }
  }
  
  /**
   * Load the previous track in the playlist
   */
  function loadPreviousTrack() {
    if (playlist.length === 0) return;
    
    // If we're at the first track, just restart it
    if (currentTrackIndex === 0) {
      console.log('At first track, restarting from beginning');
      // Just restart the current track
      activeMediaElement.currentTime = 0;
      
      // Show a brief message
      message.textContent = "Restarting current track";
      message.style.display = "block";
      setTimeout(() => message.style.display = "none", 2000);
      return;
    }
    
    // Move to the previous track (no wraparound)
    const prevIndex = currentTrackIndex - 1;
    
    // Load the previous track
    loadTrack(playlist[prevIndex]);
    
    // Show a brief message
    message.textContent = `Playing: ${playlist[prevIndex].title}`;
    message.style.display = "block";
    setTimeout(() => message.style.display = "none", 2000);
  }

  // Initialize the player at the end of the DOMContentLoaded event
  console.log('DOM fully loaded, calling initializePlayer');
  initializePlayer();
  
  // Add robust event listeners for the 'ended' event to ensure auto-advancement always works
  // These are in addition to any other 'ended' event listeners
  audio.addEventListener('ended', function() {
    console.log("GLOBAL AUDIO ENDED EVENT TRIGGERED");
    if (!isXRMode) {
      console.log(`Global audio ended event - currentTrackIndex: ${currentTrackIndex}`);
      
      // Check if this is the last track
      if (currentTrackIndex >= playlist.length - 1) {
        console.log("Reached the end of the playlist, not advancing");
        message.textContent = "End of audio tour reached";
        message.style.display = "block";
        setTimeout(() => message.style.display = "none", 3000);
      } else {
        // Force load the next sequential track
        console.log(`Forcing advancement to track ${currentTrackIndex + 1}`);
        setTimeout(() => {
          try {
            const nextIndex = currentTrackIndex + 1;
            if (playlist && playlist[nextIndex]) {
              console.log(`Loading track ${nextIndex}: ${playlist[nextIndex].title}`);
              loadTrack(playlist[nextIndex]);
              
              // Auto-play the next track
              setTimeout(() => {
                if (activeMediaElement.paused) {
                  console.log('Auto-playing next track');
                  togglePlayPause();
                }
              }, 500);
            } else {
              console.error(`Invalid next track index: ${nextIndex}`);
            }
          } catch (error) {
            console.error("Error in auto-advancement:", error);
          }
        }, 300);
      }
    }
  });
  
  video.addEventListener('ended', function() {
    console.log("GLOBAL VIDEO ENDED EVENT TRIGGERED");
    if (isXRMode) {
      console.log(`Global video ended event - currentTrackIndex: ${currentTrackIndex}`);
      
      // Check if this is the last track
      if (currentTrackIndex >= playlist.length - 1) {
        console.log("Reached the end of the playlist, not advancing");
        message.textContent = "End of audio tour reached";
        message.style.display = "block";
        setTimeout(() => message.style.display = "none", 3000);
      } else {
        // Force load the next sequential track
        console.log(`Forcing advancement to track ${currentTrackIndex + 1}`);
        setTimeout(() => {
          try {
            const nextIndex = currentTrackIndex + 1;
            if (playlist && playlist[nextIndex]) {
              console.log(`Loading track ${nextIndex}: ${playlist[nextIndex].title}`);
              loadTrack(playlist[nextIndex]);
              
              // Auto-play the next track
              setTimeout(() => {
                if (activeMediaElement.paused) {
                  console.log('Auto-playing next track');
                  togglePlayPause();
                }
              }, 500);
            } else {
              console.error(`Invalid next track index: ${nextIndex}`);
            }
          } catch (error) {
            console.error("Error in auto-advancement:", error);
          }
        }, 300);
      }
    }
  });
}); 

// Add a window load event to ensure the playlist container is properly positioned
// This handles any race conditions during page load
window.addEventListener('load', function() {
  console.log('Window fully loaded, ensuring playlist container positioning');
  
  // Final check to ensure playlist container is properly positioned
  if (playlistContainer) {
    // Reset positioning to ensure it's correct
    playlistContainer.style.visibility = 'hidden';
    playlistContainer.style.transform = 'translate(-50%, -50%) scale(0.95)';
    playlistContainer.style.top = '50%';
    playlistContainer.style.left = '50%';
    playlistContainer.style.bottom = 'auto';
    playlistContainer.style.right = 'auto';
    playlistContainer.style.margin = '0';
    
    // Force a reflow to ensure proper positioning
    void playlistContainer.offsetHeight;
    
    console.log('Playlist container positioning reset and fixed');
  }
});
