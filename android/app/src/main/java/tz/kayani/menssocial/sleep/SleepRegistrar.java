package tz.kayani.menssocial.sleep;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.SleepSegmentRequest;
import com.google.android.gms.tasks.Task;

/** Turns Google's sleep updates on and off for this app. */
public final class SleepRegistrar {
    private SleepRegistrar() {}

    public static boolean playServicesAvailable(Context ctx) {
        return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx) == ConnectionResult.SUCCESS;
    }

    /** Android 10+ asks the person ("Physical activity"); older phones grant it when the app is installed. */
    public static boolean hasPermission(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    private static PendingIntent pendingIntent(Context ctx) {
        Intent intent = new Intent(ctx, SleepReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        // Google fills the results into this intent, so it must be mutable on Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(ctx.getApplicationContext(), 7, intent, flags);
    }

    @SuppressWarnings("MissingPermission")
    public static Task<Void> register(Context ctx) {
        return ActivityRecognition.getClient(ctx)
            // The default request sends both sleep segments and the regular "asleep?" confidence readings
            .requestSleepSegmentUpdates(pendingIntent(ctx), SleepSegmentRequest.getDefaultSleepSegmentRequest());
    }

    @SuppressWarnings("MissingPermission")
    public static Task<Void> unregister(Context ctx) {
        return ActivityRecognition.getClient(ctx).removeSleepSegmentUpdates(pendingIntent(ctx));
    }
}
