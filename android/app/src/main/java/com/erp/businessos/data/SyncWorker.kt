package com.erp.businessos.data
import android.content.Context
import android.provider.Settings
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.parseToJsonElement
class SyncWorker(appContext:Context,params:WorkerParameters):CoroutineWorker(appContext,params){
 override suspend fun doWork():Result { return try { val store=LocalStore(applicationContext); val token=store.token()?:return Result.success(); val business=store.business()?:return Result.success(); val db=AppDatabase.create(applicationContext); val rows=db.outboxDao().pending(); if(rows.isEmpty()) return Result.success(); val device=Settings.Secure.getString(applicationContext.contentResolver,Settings.Secure.ANDROID_ID); val changes=rows.map{SyncChangeDto(it.clientId,it.entity,it.entityId,it.operation,Json.parseToJsonElement(it.payload))}; val result=Network.api().push(business,"Bearer $token",SyncPushRequest(device,changes)); val applied=result.results.filter{it.status=="APPLIED"}.map{it.clientId}.toSet(); rows.filter{applied.contains(it.clientId)}.forEach{db.outboxDao().delete(it)}; if(applied.size<rows.size) Result.retry() else Result.success() } catch(e:Exception){ Result.retry() } }
}
