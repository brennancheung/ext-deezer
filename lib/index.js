import { ILayoutRestorer } from '@jupyterlab/application'
import { ICommandPalette, MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils'
import { Widget } from '@lumino/widgets'
import Wave from '@foobar404/wave'

// Enable CORS demo support first before running the extension by visiting:
// http://cors-anywhere.herokuapp.com/corsdemo

const appHtml = `
<div id="deezer-app">
  <div>
    Enter a track name:
    <input id="deezer-input" value="One More Time" />
    <br />
    <button type="button" id="deezer-search">Search</button>
  </div>
  <div id="deezer-player" style="display: none">
    <div class="HStack" style="width: 800px">
      <audio id="deezer-audio" controls></audio>
      <canvas id="deezer-canvas" width="400" height="200" style="display: none; border: 1px solid #000"></canvas>
    </div>
    <div class="HStack" style="width: 800px">
      <div id="song-list"></div>
      <div id="album-info">
        <div>Album: <span id="album-title" /></div>
        <div><img id="album-img" /></div>
      </div>
      <div id="artist-info">
        <div>Artist: <span id="artist-name" /></div>
        <div><img id="artist-img" /></div>
      </div>
    </div>
  </div>
</div>
`

const fetchJson = async url => {
  const corsUrl = `https://cors-anywhere.herokuapp.com/${url}`
  try {
    const response = await fetch(corsUrl)
    const json = await response.json()
    return json
  } catch {
    return null
  }
}

const getTracks = response => response?.tracks?.data || []
const getArtistInfo = response => response?.artist || {}

const searchForTrack = async name => {
  const searchResult = await fetchJson(`http://api.deezer.com/search/track/autocomplete?limit=1&q=${name}`)
  const albumId = searchResult.data[0]?.album?.id
  if (!albumId) return null

  const albumUrl = `http://api.deezer.com/album/${albumId}`
  const album = await fetchJson(albumUrl)
  const artist = getArtistInfo(album)
  const tracks = getTracks(album)
  return { artist, album, tracks }
}

const findBestMatch = (input, tracks) => {
  const matchString = (needle, haystack) => haystack.toLowerCase().match(new RegExp(needle.toLowerCase()))
  const match = tracks.find(track => matchString(input, track.title))
  if (match) return match
  return tracks[0]
}

const plugin = [
  {
    id: 'ext_deezer',
    autoStart: true,
    requires: [ICommandPalette, ILayoutRestorer],
    activate: function (app, palette, restorer) {
      console.log('JupyterLab extension ext_deezer is activated!')

      const content = new Widget()
      const widget = new MainAreaWidget({ content })
      widget.id = 'ext-deezer'
      widget.title.label = 'Deezer'
      widget.title.closable = true

      const command = 'deezer:open'
      app.commands.addCommand(command, {
        label: 'Open Deezer Player / Visualizer',
        execute: () => {
          if (!tracker.has(widget)) {
            tracker.add(widget)
          }
          if (!widget.isAttached) {
            app.shell.add(widget, 'main')
          }
          widget.content.update()
          app.shell.activateById(widget.id)
        }
      })

      palette.addItem({ command, category: 'Music' })

      const div = document.createElement('div')
      div.innerHTML = appHtml
      content.node.appendChild(div)

      const input = div.querySelector('#deezer-input')
      const audio = div.querySelector('#deezer-audio')
      const player = div.querySelector('#deezer-player')
      const canvas = div.querySelector('#deezer-canvas')
      const artistName = div.querySelector('#artist-name')
      const artistImg = div.querySelector('#artist-img')
      const albumTitle = div.querySelector('#album-title')
      const albumImg = div.querySelector('#album-img')

      const handleTrackSelection = ({ title, preview }) => {
        audio.src = preview
        const wave = new Wave()
        wave.fromElement('deezer-audio', 'deezer-canvas', { type: 'bars' })
        audio.play()
      }

      const renderTrackEntry = track => {
        const div = document.createElement('div')
        div.innerHTML = `${track.title}`
        div.addEventListener('click', e => {
          e.preventDefault()
          handleTrackSelection(track)
        })
        return div
      }

      const displayTracks = tracks => {
        const songList = div.querySelector('#song-list')
        songList.innerHTML = ''
        tracks.forEach(track => {
          songList.appendChild(renderTrackEntry(track))
        })
      }

      const handleSearch = async () => {
        const name = input.value
        const { album, artist, tracks } = await searchForTrack(name)

        const track = findBestMatch(name, tracks)
        if (!track) return console.log('Unable to load track')

        handleTrackSelection(track)
        displayTracks(tracks)

        player.style.display = 'block'
        canvas.style.display = 'block'

        artistName.innerHTML = artist.name
        artistImg.src = artist.picture
        albumTitle.innerHTML = album.title
        albumImg.src = album.cover
      }

      const searchButton = div.querySelector('#deezer-search')
      searchButton.addEventListener('click', handleSearch)
      const onEnter = fn => e => e.keyCode === 13 && fn()
      input.addEventListener('keyup', onEnter(handleSearch))

      const tracker = new WidgetTracker({ namespace: 'deezer' })
      restorer.restore(tracker, { command, name: () => 'deezer' })
    }
  }
]

export default plugin
