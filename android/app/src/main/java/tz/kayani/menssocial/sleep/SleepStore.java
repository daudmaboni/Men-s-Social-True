package tz.kayani.menssocial.sleep;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * What Google's sleep detection reported, kept on the phone only (Step 57).
 * - segments: one per detected sleep (start, end, status), the last 30 days
 * - classify: the "how likely asleep right now" readings (time, confidence 0-100), the last 3 days,
 *   used only to give each segment a confidence.
 * Nothing else is stored: no raw sensor data.
 */
public final class SleepStore {
    private static final String PREFS = "kayani_sleep";
    private static final long DAY = 24L * 60 * 60 * 1000;

    private SleepStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context ctx) {
        return prefs(ctx).getBoolean("enabled", false);
    }

    public static void setEnabled(Context ctx, boolean on) {
        prefs(ctx).edit().putBoolean("enabled", on).apply();
    }

    private static JSONArray read(Context ctx, String key) {
        try {
            return new JSONArray(prefs(ctx).getString(key, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Add a segment; the same start+end is only kept once (Google can send a segment again). */
    public static synchronized void addSegment(Context ctx, long start, long end, int status) {
        JSONArray old = read(ctx, "segments");
        JSONArray next = new JSONArray();
        long cutoff = System.currentTimeMillis() - 30 * DAY;
        try {
            for (int i = 0; i < old.length(); i++) {
                JSONObject s = old.getJSONObject(i);
                if (s.getLong("end") < cutoff) continue;
                if (s.getLong("start") == start && s.getLong("end") == end) continue;
                next.put(s);
            }
            JSONObject s = new JSONObject();
            s.put("start", start);
            s.put("end", end);
            s.put("status", status);
            next.put(s);
        } catch (JSONException ignored) {
        }
        prefs(ctx).edit().putString("segments", next.toString()).apply();
    }

    public static synchronized void addClassify(Context ctx, long time, int confidence) {
        JSONArray old = read(ctx, "classify");
        JSONArray next = new JSONArray();
        long cutoff = System.currentTimeMillis() - 3 * DAY;
        try {
            for (int i = 0; i < old.length(); i++) {
                JSONArray c = old.getJSONArray(i);
                if (c.getLong(0) >= cutoff) next.put(c);
            }
            JSONArray c = new JSONArray();
            c.put(time);
            c.put(confidence);
            next.put(c);
        } catch (JSONException ignored) {
        }
        prefs(ctx).edit().putString("classify", next.toString()).apply();
    }

    /** Segments that ended after `since`, each with the average confidence of the readings inside it (or -1). */
    public static JSONArray segmentsSince(Context ctx, long since) {
        JSONArray segs = read(ctx, "segments");
        JSONArray cls = read(ctx, "classify");
        JSONArray out = new JSONArray();
        try {
            for (int i = 0; i < segs.length(); i++) {
                JSONObject s = segs.getJSONObject(i);
                long start = s.getLong("start");
                long end = s.getLong("end");
                if (end < since) continue;
                long sum = 0;
                int n = 0;
                for (int j = 0; j < cls.length(); j++) {
                    JSONArray c = cls.getJSONArray(j);
                    long t = c.getLong(0);
                    if (t >= start && t <= end) {
                        sum += c.getInt(1);
                        n++;
                    }
                }
                JSONObject o = new JSONObject();
                o.put("start", start);
                o.put("end", end);
                o.put("status", s.getInt("status"));
                o.put("confidence", n > 0 ? (int) (sum / n) : -1);
                out.put(o);
            }
        } catch (JSONException ignored) {
        }
        return out;
    }

    public static void clear(Context ctx) {
        prefs(ctx).edit().remove("segments").remove("classify").apply();
    }
}
