"""
SageMaker Endpoint Instance Type Update - Ready for Jupyter Notebook

Your endpoints:
1. medasr-voice-endpoint
2. medgemma-multimodal-endpoint

Target instance: ml.t3.medium ($0.05/hour = ~$36/month per endpoint)

Copy each section into a separate cell in your Jupyter notebook.
"""

# ============================================================================
# CELL 1: Setup and Check Current Status
# ============================================================================

import boto3
from datetime import datetime

# Initialize SageMaker client
region = 'us-east-1'  # Change if your endpoints are in a different region
sagemaker = boto3.client('sagemaker', region_name=region)

# Your endpoints
ENDPOINTS = [
    'medasr-voice-endpoint',
    'medgemma-multimodal-endpoint'
]

NEW_INSTANCE_TYPE = 'ml.t3.medium'

print("📋 Checking current endpoint status...\n")

endpoint_info = []
for ep_name in ENDPOINTS:
    try:
        endpoint = sagemaker.describe_endpoint(EndpointName=ep_name)
        config_name = endpoint['EndpointConfigName']
        config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
        
        instance_type = config['ProductionVariants'][0]['InstanceType']
        model_name = config['ProductionVariants'][0]['ModelName']
        status = endpoint['EndpointStatus']
        
        endpoint_info.append({
            'name': ep_name,
            'status': status,
            'instance_type': instance_type,
            'model_name': model_name,
            'config_name': config_name,
            'config': config,
            'endpoint': endpoint
        })
        
        print(f"🔹 {ep_name}")
        print(f"   Status: {status}")
        print(f"   Current Instance: {instance_type}")
        print(f"   Model: {model_name}")
        print()
    except Exception as e:
        print(f"❌ Error checking {ep_name}: {e}\n")

print(f"✅ Found {len(endpoint_info)} endpoint(s) ready to update")

# ============================================================================
# CELL 2: Calculate Cost Savings
# ============================================================================

pricing = {
    'ml.t3.medium': 0.05,
    'ml.t3.xlarge': 0.20,
    'ml.g5.xlarge': 0.70,
    'ml.g5.2xlarge': 1.40,
    'ml.p3.2xlarge': 3.06,
}

print("💰 Cost Analysis:\n")
total_current = 0
total_new = 0

for ep in endpoint_info:
    current_hourly = pricing.get(ep['instance_type'], 0)
    current_monthly = current_hourly * 24 * 30
    new_monthly = 0.05 * 24 * 30  # ml.t3.medium
    savings = current_monthly - new_monthly
    
    total_current += current_monthly
    total_new += new_monthly
    
    print(f"{ep['name']}:")
    print(f"  Current: {ep['instance_type']} = ${current_monthly:.2f}/month")
    print(f"  New: {NEW_INSTANCE_TYPE} = ${new_monthly:.2f}/month")
    print(f"  💵 Savings: ${savings:.2f}/month")
    print()

print(f"📊 Total:")
print(f"  Current Total: ${total_current:.2f}/month")
print(f"  New Total: ${total_new:.2f}/month")
print(f"  💵 Total Savings: ${total_current - total_new:.2f}/month")
print(f"  💵 Annual Savings: ${(total_current - total_new) * 12:.2f}")

# ============================================================================
# CELL 3: Update All Endpoints to ml.t3.medium
# ============================================================================

print(f"\n⚠️  WARNING: ml.t3.medium is very small (2 vCPU, 4GB RAM, no GPU)")
print(f"   GPU-based models (MedGemma) may fail or be very slow!")
print(f"   This will update {len(endpoint_info)} endpoint(s).")
print(f"   Each endpoint will be unavailable for 10-20 minutes.\n")

# Uncomment the line below and type 'yes' when ready:
# confirm = input("Type 'yes' to continue: ")

# if confirm.lower() != 'yes':
#     print("❌ Cancelled.")
# else:
#     results = []
#     
#     for ep in endpoint_info:
#         ep_name = ep['name']
#         print(f"\n{'='*60}")
#         print(f"🔄 Updating: {ep_name}")
#         print(f"{'='*60}")
#         
#         try:
#             # Create new endpoint configuration
#             timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
#             new_config_name = f"{ep['config_name']}-{NEW_INSTANCE_TYPE.replace('.', '-')}-{timestamp}"
#             
#             # Update production variants
#             variants = ep['config']['ProductionVariants']
#             new_variants = []
#             for variant in variants:
#                 new_variant = variant.copy()
#                 new_variant['InstanceType'] = NEW_INSTANCE_TYPE
#                 new_variants.append(new_variant)
#             
#             # Create new config
#             sagemaker.create_endpoint_config(
#                 EndpointConfigName=new_config_name,
#                 ProductionVariants=new_variants
#             )
#             print(f"✅ Created new config: {new_config_name}")
#             
#             # Update endpoint
#             sagemaker.update_endpoint(
#                 EndpointName=ep_name,
#                 EndpointConfigName=new_config_name
#             )
#             print(f"✅ Update initiated for {ep_name}")
#             print(f"   Endpoint will be unavailable for 10-20 minutes")
#             results.append((ep_name, True))
#             
#         except Exception as e:
#             print(f"❌ Error updating {ep_name}: {e}")
#             results.append((ep_name, False))
#     
#     # Summary
#     print(f"\n{'='*60}")
#     print("📊 Update Summary")
#     print(f"{'='*60}")
#     for ep_name, success in results:
#         status = "✅ Success" if success else "❌ Failed"
#         print(f"  {status}: {ep_name}")

# ============================================================================
# CELL 4: Quick Update (Uncomment to run immediately)
# ============================================================================

# Uncomment this entire cell to update immediately without confirmation:

for ep in endpoint_info:
    ep_name = ep['name']
    print(f"\n🔄 Updating {ep_name}...")
    
    try:
        # Create new config
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        new_config_name = f"{ep['config_name']}-{NEW_INSTANCE_TYPE.replace('.', '-')}-{timestamp}"
        
        # Update variants
        variants = ep['config']['ProductionVariants']
        new_variants = []
        for variant in variants:
            new_variant = variant.copy()
            new_variant['InstanceType'] = NEW_INSTANCE_TYPE
            new_variants.append(new_variant)
        
        # Create config
        sagemaker.create_endpoint_config(
            EndpointConfigName=new_config_name,
            ProductionVariants=new_variants
        )
        print(f"  ✅ Created config: {new_config_name}")
        
        # Update endpoint
        sagemaker.update_endpoint(
            EndpointName=ep_name,
            EndpointConfigName=new_config_name
        )
        print(f"  ✅ Update initiated for {ep_name}")
        
    except Exception as e:
        print(f"  ❌ Error: {e}")

print("\n✅ All updates initiated!")
print("⏳ Endpoints will be unavailable for 10-20 minutes")
print("📊 Check status in AWS Console or run Cell 5 to monitor")

# ============================================================================
# CELL 5: Monitor Update Status (Optional)
# ============================================================================

import time

print("⏳ Monitoring endpoint updates...")
print("   (Press Ctrl+C to stop)\n")

for ep_name in ENDPOINTS:
    print(f"\n📊 {ep_name}:")
    try:
        while True:
            endpoint = sagemaker.describe_endpoint(EndpointName=ep_name)
            status = endpoint['EndpointStatus']
            
            print(f"  Status: {status} - {datetime.now().strftime('%H:%M:%S')}")
            
            if status == 'InService':
                # Verify instance type
                config_name = endpoint['EndpointConfigName']
                config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
                actual_instance = config['ProductionVariants'][0]['InstanceType']
                print(f"  ✅ In service! Instance: {actual_instance}")
                break
            elif status in ['Failed', 'RollingBack']:
                print(f"  ❌ Failed with status: {status}")
                break
            
            time.sleep(30)  # Check every 30 seconds
            
    except KeyboardInterrupt:
        print(f"  ⏸️  Stopped monitoring {ep_name}")
        break
    except Exception as e:
        print(f"  ❌ Error: {e}")
