package tz.kayani.menssocial.sleep;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** After the phone restarts (or the app updates), Google forgets the request: turn it back on if he had it on. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        if (!SleepStore.isEnabled(context)) return;
        if (!SleepRegistrar.playServicesAvailable(context) || !SleepRegistrar.hasPermission(context)) return;
        try {
            SleepRegistrar.register(context);
        } catch (Exception ignored) {
            // Tried again the next time he opens the app
        }
    }
}
