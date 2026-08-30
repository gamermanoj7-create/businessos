package com.erp.businessos.data
import kotlinx.serialization.Serializable
import retrofit2.http.*
@Serializable data class LoginRequest(val email:String,val password:String)
@Serializable data class AuthResponse(val accessToken:String,val refreshToken:String,val expiresIn:String)
@Serializable data class Product(val id:String,val name:String,val sku:String?=null,val sellingPrice:Double=0.0,val purchasePrice:Double=0.0,val taxRate:Double=0.0)
interface Api { @POST("auth/login") suspend fun login(@Body body:LoginRequest):AuthResponse; @GET("products") suspend fun products(@Header("X-Business-Id") businessId:String,@Header("Authorization") auth:String):List<Product> }
