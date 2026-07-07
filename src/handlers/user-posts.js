import { getSession } from '../lib/session.js';
import { ForumClient } from '../lib/forum-client.js';
import { CONFIG } from '../lib/config.js';
import { parseUserPostsPage, classifyPostDates, parseSMFDate, extractBoardId } from '../lib/scraper.js';
import { log, error as logError } from '../lib/logger.js';

export async function handleUserPosts(request, env) {
  const session = await getSession(request, env);
  if (!session.forumCookies || !session.username) {
    return jsonResponse({});
  }

  const url = new URL(request.url);
  const targetYear = parseInt(url.searchParams.get('year')) || new Date().getFullYear();
  const targetMonth = parseInt(url.searchParams.get('month')) || new Date().getMonth() + 1;

  const client = new ForumClient(env);
  client.setCookies(session.forumCookies);

  const config = CONFIG(env);
  const whoBoardId = extractBoardId(config.WHO);
  const roomBoardIds = config.ROOMS.map(r => extractBoardId(r.url)).filter(Boolean);

  const allPosts = [];
  let start = 0;
  let keepFetching = true;

  while (keepFetching) {
    const profileUrl = `/index.php?action=profile;area=showposts;sa=messages;start=${start}`;
    log(`Fetching user posts page (start=${start})`);
    let resp;
    try {
      resp = await client.get(profileUrl);
    } catch {
      break;
    }
    const html = await resp.text();

    if (resp.status !== 200) break;

    const posts = parseUserPostsPage(html);
    if (posts.length === 0) break;

    allPosts.push(...posts);

    const oldestPost = posts[posts.length - 1];
    const oldestPub = oldestPost.pubDate;

    if (oldestPub.year < targetYear || (oldestPub.year === targetYear && oldestPub.month < targetMonth)) {
      keepFetching = false;
    } else {
      const pagelinks = html.match(/<span class="pages">[\s\S]*?<\/span>[\s\S]*?(?:<a class="nav_page"[^>]*>.*?<\/a>)+/);
      if (pagelinks && pagelinks[0].includes('next_page')) {
        start += 15;
      } else {
        keepFetching = false;
      }
    }
  }

  const { reservations, announcements } = classifyPostDates(allPosts, whoBoardId, roomBoardIds);

  const result = {};
  const allDays = new Set([...Object.keys(reservations), ...Object.keys(announcements)]);
  for (const key of allDays) {
    const [day, month] = key.split('-').map(Number);
    if (month !== targetMonth) continue;
    result[day] = {
      reservation: !!reservations[key],
      announcement: !!announcements[key],
    };
  }

  log(`User posts result for ${targetYear}/${targetMonth}:`, result);
  return jsonResponse(result);
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
