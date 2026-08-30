package com.erp.businessos.data
import android.content.Context
import com.erp.businessos.BuildConfig
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
object Network { fun api():SyncApi = Retrofit.Builder().baseUrl(BuildConfig.API_BASE_URL).addConverterFactory(Json{ignoreUnknownKeys=true}.asConverterFactory("application/json".toMediaType())).build().create(SyncApi::class.java) }
