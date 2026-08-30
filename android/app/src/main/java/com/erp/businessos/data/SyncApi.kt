package com.erp.businessos.data
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.http.*
@Serializable data class SyncChangeDto(val clientId:String,val entity:String,val entityId:String,val operation:String,val payload:JsonElement,val version:Int=1)
@Serializable data class SyncPushRequest(val deviceId:String,val changes:List<SyncChangeDto>)
@Serializable data class SyncPushResponse(val results:List<SyncResult>)
@Serializable data class SyncResult(val clientId:String,val status:String,val entityId:String?=null)
interface SyncApi { @POST("sync/push") suspend fun push(@Header("X-Business-Id") businessId:String,@Header("Authorization") auth:String,@Body body:SyncPushRequest):SyncPushResponse }
