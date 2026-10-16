package tz.kayani.menssocial;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import tz.kayani.menssocial.sleep.SleepPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own native piece: Google's sleep detection (Step 57)
        registerPlugin(SleepPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
