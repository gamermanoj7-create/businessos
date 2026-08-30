package com.erp.businessos.data
import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
private val Context.store by preferencesDataStore("business_os")
class LocalStore(private val context:Context){ companion object{val TOKEN=stringPreferencesKey("access_token");val REFRESH=stringPreferencesKey("refresh_token");val BUSINESS=stringPreferencesKey("business_id")} suspend fun token()=context.store.data.first()[TOKEN]; suspend fun business()=context.store.data.first()[BUSINESS]; suspend fun save(a:String,r:String,b:String){context.store.edit{it[TOKEN]=a;it[REFRESH]=r;it[BUSINESS]=b}} suspend fun clear(){context.store.edit{it.clear()}}}
