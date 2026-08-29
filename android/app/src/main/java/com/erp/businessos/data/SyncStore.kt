package com.erp.businessos.data
import androidx.room.*
@Entity(tableName="sync_outbox")
data class SyncOutbox(@PrimaryKey val clientId:String,val entity:String,val entityId:String,val operation:String,val payload:String,val createdAt:Long=System.currentTimeMillis())
@Dao interface SyncOutboxDao { @Query("SELECT * FROM sync_outbox ORDER BY createdAt LIMIT 100") suspend fun pending():List<SyncOutbox>; @Insert suspend fun add(item:SyncOutbox); @Delete suspend fun delete(item:SyncOutbox) }
