"""Refresh public videos; preserve history and manually associated file IDs."""
import json
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

CHANNEL = 'UCeK9EVzNsmiD2PLTMIe_t_w'
CATALOG = Path('youtube-catalog.json')

def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Videira-Video-Sync/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()

def api_catalog(key):
    params = {'part': 'snippet,status', 'playlistId': 'UU' + CHANNEL[2:], 'maxResults': 50, 'key': key}
    videos = []
    while True:
        page = json.loads(get('https://www.googleapis.com/youtube/v3/playlistItems?' + urllib.parse.urlencode(params)))
        for item in page['items']:
            if item.get('status', {}).get('privacyStatus') == 'public':
                snippet = item['snippet']
                videos.append({'id': snippet['resourceId']['videoId'], 'title': snippet['title'], 'description': snippet['description']})
        if not page.get('nextPageToken'):
            return videos
        params['pageToken'] = page['nextPageToken']

def feed_catalog():
    root = ET.fromstring(get('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL))
    ns = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'm': 'http://search.yahoo.com/mrss/'}
    return [{'id': e.findtext('yt:videoId', namespaces=ns), 'title': e.findtext('a:title', namespaces=ns),
             'description': e.findtext('m:group/m:description', default='', namespaces=ns)}
            for e in root.findall('a:entry', ns)]

def merge(recent, previous):
    result = {}
    for video in recent + previous:
        if video.get('id') and video.get('title'):
            result.setdefault(video['id'], video)
    return list(result.values())

def main():
    key = os.environ.get('YOUTUBE_API_KEY', '').strip()
    try:
        videos = api_catalog(key) if key else feed_catalog()
    except Exception:
        if not key:
            raise SystemExit('Não foi possível consultar o feed público do YouTube. Nenhuma alteração publicada.')
        print('Consulta pela API indisponível; consultando o feed público.')
        videos = feed_catalog()
    if not videos:
        raise SystemExit('O YouTube não retornou vídeos. O catálogo existente foi preservado.')
    previous = json.loads(CATALOG.read_text()) if CATALOG.exists() else []
    result = merge(videos, previous)
    CATALOG.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'Catálogo atualizado: {len(result)} vídeos; mais recente: {result[0]["title"]}')

if __name__ == '__main__':
    main()
