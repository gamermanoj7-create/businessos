package com.erp.businessos.data
import androidx.room.*
@Entity(tableName="products") data class ProductEntity(@PrimaryKey val id:String,val name:String,val sku:String?,val sellingPrice:Double,val purchasePrice:Double,val taxRate:Double,val updatedAt:Long)
@Dao interface ProductDao{ @Query("SELECT * FROM products ORDER BY name") suspend fun all():List<ProductEntity>; @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun upsertAll(items:List<ProductEntity>); @Query("DELETE FROM products") suspend fun clear() }
@Database(entities=[ProductEntity::class],version=1,exportSchema=false) abstract class AppDatabase:RoomDatabase(){abstract fun productDao():ProductDao; abstract fun outboxDao():SyncOutboxDao; companion object{fun create(c:android.content.Context)=Room.databaseBuilder(c,AppDatabase::class.java,"business_os.db").build()}}
