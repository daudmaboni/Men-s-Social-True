package tz.kayani.menssocial.sleep;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.google.android.gms.location.SleepClassifyEvent;
import com.google.android.gms.location.SleepSegmentEvent;
import java.util.List;

/** Google Play services calls this with sleep results, even while the app is closed. We only store them. */
public class SleepReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (SleepSegmentEvent.hasEvents(intent)) {
            List<SleepSegmentEvent> events = SleepSegmentEvent.extractEvents(intent);
            for (SleepSegmentEvent e : events) {
                SleepStore.addSegment(context, e.getStartTimeMillis(), e.getEndTimeMillis(), e.getStatus());
            }
        }
        if (SleepClassifyEvent.hasEvents(intent)) {
            List<SleepClassifyEvent> events = SleepClassifyEvent.extractEvents(intent);
            for (SleepClassifyEvent e : events) {
                SleepStore.addClassify(context, e.getTimestampMillis(), e.getConfidence());
            }
        }
    }
}
