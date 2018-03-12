const { JSDOM } = require('jsdom');

// figure out multiple appearances of songs
// figure out three instances of make it better so real


JSDOM.fromURL('https://remywiki.com/DanceDanceRevolution_A_Full_Song_List')
.then(buildSongList)
.then(identifyShockCharts)
.then(songs => {
  songs.forEach((song) => console.log(song));
  console.log('Found shock charts', songs.length);
});

// identifyShockCharts(['https://remywiki.com/Desert_Journey']).then(songs => console.log(songs));

function buildSongList(dom) {
  const songLinks = new Set();

  for (const node of dom.window.document.querySelectorAll('#mw-content-text li')) {
    const link = node.querySelector('a');
    if (!link) {
      continue;
    }
    // ignore TOC links
    if (link.attributes.href.value.startsWith('#')) {
      continue;
    }
    // if (link.parentElement.tagName === 'I') {
    //   continue; // japan only
    // }
    // if it has any links, take the first one, it's probably a song
    songLinks.add(link.href);
  }
  return songLinks;
}

function identifyShockCharts(songLinks) {
  songLinks = Array.from(songLinks);
  let currentLinkIndex = 0;
  const shockArrowSongs = [];

  function crawlNext() {
    if (currentLinkIndex >= songLinks.length) {
      return shockArrowSongs;
    }
    const url = songLinks[currentLinkIndex];
    console.log(`fetching (${currentLinkIndex + 1}/${songLinks.length})`, url);
    return JSDOM.fromURL(url).then(dom => {
      for (const cell of dom.window.document.querySelectorAll('td:first-child')) {
        if (cell.innerHTML.indexOf('Shock Arrows') === -1) {
          continue;
        }

        for (const innerCell of cell.parentElement.cells) {
          const match = innerCell.innerHTML.trim().match(/(\d+) \/ (\d+) \/ (\d+)/);
          if (!match) {
            continue;
          }
          const shockCount = parseInt(match[3], 10);
          if (shockCount) {
            shockArrowSongs.push({
              title: dom.window.document.querySelector('h1').innerHTML,
              shockCount,
              challenge: innerCell.attributes.style.value === 'background:#aaaaff;',
            });
          }
        }
      }
      currentLinkIndex += 1;
    }).catch(err => {
      console.error(`Couldn\'t fetch ${url}`, err);
    }).then(crawlNext);
  }

  return crawlNext();
}
