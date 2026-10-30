package expo.modules.smsreader

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsPermissionException : CodedException(message = "Permission to read text messages has not been granted")

// Reads text messages from the phone's SMS inbox. Nothing is sent anywhere.
class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    // Inbox messages received after `sinceMillis`, newest first, at most `limit` of them
    AsyncFunction("getInboxMessages") { sinceMillis: Double, limit: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw SmsPermissionException()
      }
      val messages = mutableListOf<Map<String, Any?>>()
      context.contentResolver.query(
        Uri.parse("content://sms/inbox"),
        arrayOf("_id", "address", "body", "date"),
        "date > ?",
        arrayOf(sinceMillis.toLong().toString()),
        "date DESC"
      )?.use { cursor ->
        while (cursor.moveToNext() && messages.size < limit) {
          messages.add(
            mapOf(
              "id" to cursor.getString(0),
              "address" to cursor.getString(1),
              "body" to (cursor.getString(2) ?: ""),
              "date" to cursor.getLong(3).toDouble()
            )
          )
        }
      }
      messages
    }
  }
}
